const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const MEDUSA_API_URL = 'http://localhost:9000'; // Medusa API URL
const PUBLISHABLE_API_KEY = 'pk_0296dd27f5d7871b699d2019d24510bd07133b742142d526f63f8a1851162c9c'; // Your public API Key

const productMapping = {
    "T-Shirt": "Medusa T-Shirt",
    "Sweatshirt": "Medusa Sweatshirt",
    "Shorts": "Medusa Shorts",
    "Sweatpants": "Medusa Sweatpants",
    "Jacket": "Winter Jacket",
    "Kurti": "Kurti"
};

app.post('/webhook', async (req, res) => {
    console.log("Incoming request:", JSON.stringify(req.body, null, 2));

    const intentName = req.body.queryResult.intent.displayName; // Identify the intent
    const parameters = req.body.queryResult.parameters; // Extract parameters

    console.log("Extracted Parameters:", parameters); // Log the parameters

    if (intentName === "product") {
        try {
            const response = await axios.get(`${MEDUSA_API_URL}/store/products`, {
                headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY },
            });

            const products = response.data.products.map(product => product.title).join(', ');
            const reply = `We have the following products: ${products}. Which product would you like to know more about?`;

            res.json({
                fulfillmentText: reply,
                source: 'medusa-webhook'
            });
        } catch (error) {
            console.error("Error fetching products:", error);
            res.json({
                fulfillmentText: "Sorry, I couldn't fetch the product list right now.",
                source: 'medusa-webhook'
            });
        }
    } else if (intentName === "checking_availability") {
        const simplifiedProductName = parameters.product;
        const fullProductName = productMapping[simplifiedProductName];

        if (!fullProductName) {
            res.json({
                fulfillmentText: `Sorry, I couldn't find ${simplifiedProductName} in our store.`,
                source: 'medusa-webhook'
            });
            return;
        }

        try {
            const response = await axios.get(`${MEDUSA_API_URL}/store/products`, {
                headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY },
            });

            const product = response.data.products.find(p => p.title.toLowerCase() === fullProductName.toLowerCase());

            if (product) {
                const sizeColorOptions = product.variants.map(variant => `${variant.title} / ${variant.options.map(option => option.value).join(' / ')}`).join(', ');
                const reply = `Yes, the ${product.title} is available in the following sizes and colors: ${sizeColorOptions}. Which size would you like?`;

                res.json({
                    fulfillmentText: reply,
                    outputContexts: [
                        {
                            name: `${req.body.session}/contexts/product-selection`,
                            lifespanCount: 5,
                            parameters: { product: simplifiedProductName }
                        }
                    ]
                });
            } else {
                res.json({
                    fulfillmentText: `Sorry, I couldn't find ${simplifiedProductName} in our store.`,
                    source: 'medusa-webhook'
                });
            }
        } catch (error) {
            console.error("Error fetching product details:", error);
            res.json({
                fulfillmentText: "Sorry, I couldn't check the product details right now.",
                source: 'medusa-webhook'
            });
        }
    } else if (intentName === "Choose Size") {
        const productContext = req.body.queryResult.outputContexts.find(context => context.name.includes('product-selection'));
        const selectedSize = parameters.size;

        if (!productContext) {
            res.json({
                fulfillmentText: "I'm not sure which product you're referring to. Could you specify?",
                source: 'medusa-webhook'
            });
            return;
        }

        const productName = productMapping[productContext.parameters.product];

        try {
            const response = await axios.get(`${MEDUSA_API_URL}/store/products`, {
                headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY },
            });

            const product = response.data.products.find(p => p.title.toLowerCase() === productName.toLowerCase());

            if (product) {
                const colorOptions = product.options.find(option => option.title === "Color");

                if (!colorOptions) {
                    res.json({
                        fulfillmentText: `Sorry, I couldn't find color options for the ${productName}.`,
                        source: 'medusa-webhook'
                    });
                    return;
                }

                const colors = colorOptions.values.map(value => value.value).join(", ");
                const reply = `The available colors for the ${productName} in size ${selectedSize} are: ${colors}. Which color would you like?`;

                res.json({
                    fulfillmentText: reply,
                    outputContexts: [
                        {
                            name: `${req.body.session}/contexts/size-selection`,
                            lifespanCount: 5,
                            parameters: { product: productContext.parameters.product, size: selectedSize }
                        }
                    ]
                });
            } else {
                res.json({
                    fulfillmentText: `Sorry, I couldn't find the product details for ${productName}.`,
                    source: 'medusa-webhook'
                });
            }
        } catch (error) {
            console.error("Error fetching product details for size:", error);
            res.json({
                fulfillmentText: "Sorry, I couldn't check the product details right now.",
                source: 'medusa-webhook'
            });
        }
    } else if (intentName === "Choose Color") {
        const sizeContext = req.body.queryResult.outputContexts.find(context => context.name.includes('size-selection'));
        const selectedColor = parameters.color;

        if (!sizeContext) {
            res.json({
                fulfillmentText: "I'm not sure which product or size you're referring to. Could you specify?",
                source: 'medusa-webhook'
            });
            return;
        }

        const productName = productMapping[sizeContext.parameters.product];
        const selectedSize = sizeContext.parameters.size;

        try {
            const response = await axios.get(`${MEDUSA_API_URL}/store/products`, {
                headers: { 'x-publishable-api-key': PUBLISHABLE_API_KEY },
            });

            const product = response.data.products.find(p => p.title.toLowerCase() === productName.toLowerCase());

            if (product) {
                const priceOption = product.options.find(option => option.title === "Price");

                if (!priceOption) {
                    res.json({
                        fulfillmentText: `Sorry, I couldn't find price information for the ${productName}.`,
                        source: 'medusa-webhook'
                    });
                    return;
                }

                const priceValues = priceOption.values.map(value => value.value);
                const reply = `The price options for the ${productName} in size ${selectedSize} and color ${selectedColor} are: ${priceValues.join(", ")}.`;

                res.json({
                    fulfillmentText: reply
                });
            } else {
                res.json({
                    fulfillmentText: `Sorry, I couldn't find the product details for ${productName}.`,
                    source: 'medusa-webhook'
                });
            }
        } catch (error) {
            console.error("Error fetching product details for color:", error);
            res.json({
                fulfillmentText: "Sorry, I couldn't check the product details right now.",
                source: 'medusa-webhook'
            });
        }
    } else {
        res.json({
            fulfillmentText: "Sorry, I didn't understand your request.",
            source: 'medusa-webhook'
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});