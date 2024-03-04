import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;
const API_URL = "https://openexchangerates.org/api/latest.json?app_id=";
const yourAPIKey = "015c691a73de4e65877f35f5d775d7c2";

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("./HTML_1"));

app.get("/", (req, res) => {
  res.render("index.ejs", { content: "API Response.", content1: "API Response." });
});

app.get("/Refresh", async (req, res) => {
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

    const result = await axios.get(API_URL + yourAPIKey);

    const timeStamp = result.data.timestamp;
    const dateFromTimestamp = new Date(timeStamp * 1000);
    console.log(dateFromTimestamp);

    const ratesEntries = Object.entries(result.data.rates);
    const fifteenthEntry = ratesEntries[1];
    const fifteenthRate = fifteenthEntry[1];



    const dateTime = new Date();

    // Call the asynchronous function and get the fetched data
    const quizData = await fetchQuizData(db, fifteenthEntry, fifteenthRate, dateTime, ratesEntries, dateFromTimestamp);
    // Log the content and structure of quizData
    console.log("Quiz Data:", quizData);

    // Ensure that quizData is an array before trying to access its elements
    if (Array.isArray(quizData) && quizData.length >= 1) {
      const currency = quizData[1].symbol.trim(); // Trim to remove any leading/trailing spaces
      const rate = parseFloat(quizData[1].rate); // Convert rate to a number
      const dateTime = quizData[1].date;
      // Get the year, month (adjusted for zero-index), and day
      const year = dateTime.getFullYear();
      const month = dateTime.getMonth() + 1; // Add 1 because months are 0-indexed
      const day = dateTime.getDate();

      // Construct the date string in the desired format
      const formattedDate = `${year}-${month}-${day}`;

      // If you want to display both the currency code and the rate, you can construct a string or object
      const content = `Currency: ${fifteenthEntry[0]}, Rate: ${fifteenthRate}`;
      const content1 = `Currency: ${currency}, Rate: ${rate}, Date: ${formattedDate}`;

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

const fetchQuizData = async (db, fifteenthEntry, fifteenthRate, dateTime, ratesEntries, dateFromTimestamp) => {
    try {
      console.log("Fetching quiz data...");
      console.log("rateEntries[0] = ", ratesEntries[0]);

      //console.log(dateFromTimestamp);

      // Insert data into the 'symbol' table using parameterized query with all data from the JSON
      //for(let i=0; i<ratesEntries.length; i++)
      for(let i=0; i<2; i++)
      {
        await db.query("INSERT INTO symbol (symbol, rate, date) VALUES ($1, $2, $3)", ["USD/" + ratesEntries[i][0], ratesEntries[i][1], dateTime]);
      }
      //await db.query("INSERT INTO symbol (symbol, rate, date) VALUES ($1, $2, $3)", ["USD/" + fifteenthEntry[0], fifteenthRate, dateTime]);
  
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
