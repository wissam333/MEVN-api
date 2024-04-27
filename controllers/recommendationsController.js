const natural = require("natural");
const Order = require("../models/Order");
const cache = require("memory-cache");
const Product = require("../models/Product");
const Favorite = require("../models/Favorite");

const productRecommendations = async (req, res) => {
  // preprocess text for TF-IDF
  const preprocessText = (text) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // remove characters that are not alphanumeric
      .split(/\s+/); // remove extra spaces

  // generate TF-IDF vectors for product titles and categories
  // every product has document
  const generateTFIDFVectors = (productData) => {
    const tfidf = new natural.TfIdf();

    productData.forEach((product) => {
      const combinedText =
        product.title +
        " " +
        (product.categories ? product.categories.join(" ") : "");
      const processedText = preprocessText(combinedText).join(" ");
      tfidf.addDocument(processedText);
    });

    return tfidf;
  };

  // generate recommendations based on a given product
  const generateRecommendations = async (product, tfidf, productData) => {
    // calculates the TF-IDF scores for the main product
    // but before that we should preprocess the product info
    const productVector = tfidf.tfidfs(
      preprocessText(
        product.title +
          " " +
          (product.categories ? product.categories.join(" ") : "")
      ).join(" ")
    );

    // calculates the TF-IDF scores for every product else
    let recommendations = await Promise.all(
      productData
        .filter((otherProduct) => otherProduct._id !== product._id) // remove the main product
        .map(async (otherProduct) => {
          const otherProductVector = tfidf.tfidfs(
            preprocessText(
              otherProduct.title +
                " " +
                (otherProduct.categories
                  ? otherProduct.categories.join(" ")
                  : "")
            ).join(" ")
          );
          // cosine similarity between main product and other products
          const similarity = contentBasedCosineSimilarity(
            productVector, // main product
            otherProductVector // other products
          );
          return { product: otherProduct, similarity };
        })
    );

    recommendations = recommendations
      .filter((product) => product.similarity !== 1) // remove the main product
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10); // Limiting to 10 recommendations
    return recommendations;
  };

  // calculate cosine similarity between two vectors
  // https://en.wikipedia.org/wiki/Cosine_similarity
  const contentBasedCosineSimilarity = (vectorA, vectorB) => {
    const dotProduct = vectorA.reduce(
      (acc, val, i) => acc + val * vectorB[i],
      0
    );
    const magnitudeA = Math.sqrt(
      vectorA.reduce((acc, val) => acc + val * val, 0)
    );
    const magnitudeB = Math.sqrt(
      vectorB.reduce((acc, val) => acc + val * val, 0)
    );
    return dotProduct / (magnitudeA * magnitudeB);
  };

  try {
    const productId = req.params.productId;
    const productInfo = await Product.findById(productId);
    // caching
    const cacheKey = JSON.stringify("recommendations/" + productId);
    const cachedProducts = cache.get(cacheKey);
    // return the cached products and ignore getting data from database
    if (cachedProducts) {
      return res.status(200).json(cachedProducts);
    }

    const productData = await Product.find({});
    const tfidf = generateTFIDFVectors(productData);
    const recommendations = await generateRecommendations(
      productInfo,
      tfidf,
      productData
    );
    cache.put(cacheKey, recommendations, 10 * 60 * 1000); // Cache for 10 minute
    res.status(200).json(recommendations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const userRecommendations = async (req, res) => {
  // format and prepare data for recommendation system
  const formatData = async () => {
    try {
      // retrieve data from collections concurrently
      const [orderData, likes] = await Promise.all([
        Order.find({}, { userId: 1, products: 1 }),
        Favorite.find({}, { productsId: 1, userId: 1 }),
      ]);
      const userItemMatrix = {};

      // process order data
      orderData.forEach((order) => {
        if (!userItemMatrix[order.userId]) {
          userItemMatrix[order.userId] = {}; // initialize row in userItemMatrix
        }
        order.products.forEach((product) => {
          userItemMatrix[order.userId][product.productId] = 1; // increment the score of interaction with products
        });
      });

      // process likes data
      likes.forEach((user) => {
        user.productsId.forEach((productId) => {
          if (!userItemMatrix[user.userId]) {
            userItemMatrix[user.userId] = {}; // initialize row in userItemMatrix
          }
          if (!userItemMatrix[user.userId][productId]) {
            userItemMatrix[user.userId][productId] = 1; // assign a score (1) if user liked the product
          } else {
            userItemMatrix[user.userId][productId] += 1; // increment score if it has score before (+1)
          }
        });
      });

      console.log(userItemMatrix);
      return userItemMatrix;
    } catch (error) {
      throw new Error("error formatting data: " + error.message);
    }
  };

  // calculate similarity scores based on the products
  const calculateSimilarityScores = (mainUser, otherUser) => {
    // get an array of keys (product IDs) of products interacted with by the main user
    const mainUserProducts = Object.keys(mainUser);
    // get an array of keys (product IDs) of products interacted with by the other user
    const otherUserProducts = Object.keys(otherUser);
    // find the intersection of products between the main user and the other user
    const intersection = mainUserProducts.filter((product) =>
      otherUserProducts.includes(product)
    );

    // calculate the similarity score based on the number of common products
    const similarity =
      intersection.length / //Number of common products
      Math.sqrt(mainUserProducts.length * otherUserProducts.length);

    return similarity;
  };

  try {
    const userId = req.params.userId;
    const userItemMatrix = await formatData();
    // Calculate similarity scores between the main user and all other users
    const similarityScores = [];
    for (const otherUserId in userItemMatrix) {
      if (otherUserId !== userId) {
        const similarity = calculateSimilarityScores(
          userItemMatrix[userId],
          userItemMatrix[otherUserId]
        );
        similarityScores.push({ userId: otherUserId, similarity });
      }
    }
    // sort similar users by similarity score
    similarityScores.sort((a, b) => b.similarity - a.similarity);

    // initialize an object to store recommended products
    const recommendedProducts = {};
    // consider top k similar users
    const k = 10;
    for (let i = 0; i < Math.min(k, similarityScores.length); i++) {
      // used min if the users are less than k
      const neighborId = similarityScores[i].userId;
      const similarity = similarityScores[i].similarity;
      const neighborInteractions = userItemMatrix[neighborId];

      // iterate over neighbor's interactions to recommend products
      for (const productId in neighborInteractions) {
        // exclude products the current user has interacted with
        if (!(productId in userItemMatrix[userId])) {
          if (!recommendedProducts[productId]) {
            recommendedProducts[productId] = 0; // initialize row in recommendedProducts ( productId : 0 )
          }
          // Weighted sum approach: accumulate similarity * interaction for each product
          recommendedProducts[productId] +=
            similarity * neighborInteractions[productId];
          // console.log(neighborInteractions[productId]); // number of interactions for each product
        }
      }
    }

    // Convert recommended products object to an array of objects sorted by score
    const sortedRecommendedProducts = Object.entries(recommendedProducts)
      .map(([productId, score]) => ({ productId, score }))
      .sort((a, b) => b.score - a.score)
      .filter((product) => product.score > 0); // remove products with 0 score

    // Find the maximum score
    // reduce syntax so i won't forget it : reduce((accumulator, currentValue) => mathematics formula, initialValue for accumulator)
    const maxScore = sortedRecommendedProducts.reduce(
      (max, product) => Math.max(max, product.score),
      0
    );

    // Normalize scores
    sortedRecommendedProducts.forEach((product) => {
      product.score /= maxScore;
    });

    // get product info from IDs
    const getProductInfo = async (productId) => {
      try {
        const product = await Product.findById(productId);
        if (!product) {
          return null; // Return null if product not found
        }
        return product;
      } catch (error) {
        console.error("Error fetching product information:", error.message);
        throw error;
      }
    };

    // loop and get each product info
    const sortedRecommendedProductsWithInfo = sortedRecommendedProducts.map(
      async (product) => {
        const productInfo = await getProductInfo(product.productId);
        // used toObject function because productInfo returns Mongoose documents and we want to turn it to js object
        return { ...productInfo.toObject(), score: product.score };
      }
    );
    // await for Promises because if i send it without awaiting i will be sending pending Promises not data
    const productsWithInfo = await Promise.all(
      sortedRecommendedProductsWithInfo
    );

    // caching
    const cacheKey = JSON.stringify("/recommendations" + req.params.userId);
    const cachedProducts = cache.get(cacheKey);
    // return the cached products and ignore getting data from database
    if (cachedProducts) {
      return res.status(200).json(cachedProducts);
    }
    cache.put(
      cacheKey,
      { suggestedProducts: productsWithInfo },
      10 * 60 * 1000
    ); // Cache for 10 minute
    // Send the response
    res.status(200).json({ suggestedProducts: productsWithInfo });
  } catch (error) {
    console.error("Error suggesting products:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  productRecommendations,
  userRecommendations,
};
