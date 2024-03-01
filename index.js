import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;
const API_URL = "https://openexchangerates.org/api/latest.json?app_id=015c691a73de4e65877f35f5d775d7c2";
const yourAPIKey = "015c691a73de4e65877f35f5d775d7c2";

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index.ejs", { content: "API Response.", content1: "API Response." });
});

app.get("/noAuth", async (req, res) => {
  try {
    console.log("Button clicked");

    // Create a new database client for each request
    const db = new pg.Client({
      user: "postgres",
      host: "localhost",
      database: "currencies",
      password: "Test123!",
      port: 5432,
    });

    await db.connect();
    console.log("Connected to the database.");

    const result = await axios.get(API_URL);
    const ratesEntries = Object.entries(result.data.rates);
    const fifteenthEntry = ratesEntries[14];
    const fifteenthRate = fifteenthEntry[1];

    // Call the asynchronous function and get the fetched data
    const quizData = await fetchQuizData(db, fifteenthEntry, fifteenthRate);
    // Log the content and structure of quizData
    console.log("Quiz Data:", quizData);

    // Ensure that quizData is an array before trying to access its elements
    if (Array.isArray(quizData) && quizData.length >= 1) {
      const currency = quizData[0].symbol.trim(); // Trim to remove any leading/trailing spaces
      const rate = parseFloat(quizData[0].rate); // Convert rate to a number

      // If you want to display both the currency code and the rate, you can construct a string or object
      const content = `Currency: ${fifteenthEntry[0]}, Rate: ${fifteenthRate}`;
      const content1 = `Currency: ${currency}, Rate: ${rate}`;

      res.render("index.ejs", {
        content: JSON.stringify(content),
        content1: JSON.stringify(content1),
      });
    } else {
      res.status(404).send("Quiz data not available or not in the expected format.");
    }

    // Close the database connection after the request is processed
    await db.end();
    console.log("Database connection closed.");
  } catch (error) {
    res.status(404).send(error.message);
  }
});

const fetchQuizData = async (db, fifteenthEntry, fifteenthRate) => {
    try {
      console.log("Fetching quiz data...");
      // Insert data into the 'symbol' table using parameterized query
      await db.query("INSERT INTO symbol (symbol, rate) VALUES ($1, $2)", [fifteenthEntry[0], fifteenthRate]);
  
      // Fetch data from the 'symbol' table
      const result = await db.query("SELECT * FROM symbol");
      return result.rows;
    } catch (error) {
      console.error("Error fetching or inserting quiz data:", error.stack);
      throw error;
    }
  };
  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
