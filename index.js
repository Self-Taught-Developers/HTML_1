import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

//open exchange rates
//const API_URL = "https://openexchangerates.org/api/latest.json?app_id=";
//const yourAPIKey = "015c691a73de4e65877f35f5d775d7c2";

//fcsapi
const API_URL = "https://fcsapi.com/api-v3/forex/latest?symbol=all_forex&access_key=";
const yourAPIKey = "ELJUZSh8SW3bCFqj5L2DHCfB";

//https://fcsapi.com/api-v3/forex/latest?symbol=all_forex&access_key=ELJUZSh8SW3bCFqj5L2DHCfB

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

    //get raw data from the API endpoint
    const result = await axios.get(API_URL + yourAPIKey);
    /* const result = {
      status: true,
      code: 200,
      msg: "Successfully",
      response: [
        {
          id: "1",
          o: "1.09231",
          h: "1.09398",
          l: "1.09207",
          c: "1.09376",
          ch: "+0.00145",
          cp: "+0.13%",
          t: "1710222656",
          s: "EUR/USD",
          tm: "2024-03-12 05:50:56"
        }
        // Add more records if needed
      ],
      info: {
        server_time: "2024-03-12 05:51:55 UTC",
        credit_count: 20
      }
    }; */
    
    
    console.log("Data from the JSON: ", result.data.info.server_time);
    //test
    //console.log("Data from the JSON: ", result.info.server_time);

    //check the date form the JSON from the fcsapi
    const apiDate = result.data.info.server_time;
    //test
    //const apiDate = result.info.server_time;

    const dateTimestamp = await dateConversion(apiDate);
    //const dateTimestamp = apiDate;
    console.log("formattedDate returned:", dateTimestamp);
    
    //save data from the JSON file into object variable
    const ratesEntries = result.data.response;
    //test
    //const ratesEntries = result.response;

    console.log("ratesEntries[0]:", ratesEntries[0].s);

    //read the data from the second(first is 0, second is 1) record
    const fifteenthEntry = ratesEntries[0];
    const fifteenthRate = fifteenthEntry[0];


    //call the aysnchronous function and save received data into the database
    await saveAPIDataIntoDatabase (db, ratesEntries, dateTimestamp);
    console.log("Done saving API data into database. Moving forward");

    //read the data from the database, make a calculation and then save the calculated values for later use
    await readDatabaseAndFilter(db);
    console.log("Done saving calculated data into database. Moving forward");

    //read the data from the database for certain symbols, like USD, and then calculate the strength for the USD and save the strength into the database - third table
    await calculateStrength (db);
    console.log("Calculation of a strength for certain symbols is done. Moving forward");

    // Call the asynchronous function and get the fetched data from the Database
    const quizData = await fetchQuizData(db, ratesEntries, dateTimestamp);
    // Ensure that quizData is an array before trying to access its elements
    if (Array.isArray(quizData) && quizData.length >= 1) {
      const currency = quizData[1].symbol.trim(); // Trim to remove any leading/trailing spaces
      const rate = parseFloat(quizData[1].rate); // Convert rate to a number
      const dateTime = quizData[1].date;

      console.log("Date from the Database:", dateTime);

      // If you want to display both the currency code and the rate, you can construct a string or object
      const content = `Currency: ${fifteenthEntry[0]}, Rate: ${fifteenthRate}`;
      const content1 = `Currency: ${currency}, Rate: ${rate}, Date: ${dateTime}`;

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
//------------------------ FUNCTION ---------------------------------//
//read data about certain symbol and calculate average strength and save it into the database for the chart
const calculateStrength = async (db) =>{
  console.log("Entering into strength calculation function")
  try{
    const symbol = ["USD/EUR", "USD/GBP", "USD/CAD", "USD/CHF", "USD/JPY", "USD/AUD", "USD/NZD"];
    console.log("Symbol lenght is:", symbol.length);
    let dateToday = new Date(); // current date
    let varE;
    let varF = 0;
    let varH = 0;
    let varG = 0;
    for(let i=0; i<symbol.length; i++)
    {
      console.log("Entering into for loop:");
      varE = await db.query("SELECT * FROM calculation WHERE (symbol, date) = ($1, $2)", [symbol[i], dateToday.toISOString()]);
      if (varE.rows.length > 0)
      {
        varF += varE.rows[i].vard; 
        console.log("varE length is:", varE.rows.length)
        varH++;
        if(varE.rows.length > 0){
          console.log("Sum of strength is:", varF);
          varG = varF/varH;
          console.log("Average strength is:", varG);
          console.log("varH is:", varH);

          
        }else {
          console.log(`No data found for ${symbol[i]}`);
        }
      }else {
        console.log(`No data found for ${symbol[i]}`);
      };
    };
    await db.query("INSERT INTO strength (symbol, varstrength, date) VALUES ($1, $2, $3)", ["USD", varG, dateToday]);

    return;
  }catch (error){
    console.error("Error reading/inserting data into strength database:", error.stack);
    throw error;
  }
  
}

//------------------------ FUNCTION ---------------------------------//
//read data from the database and filter symbols and make the calculation
const readDatabaseAndFilter = async (db) =>{
  console.log("Entering into database for reading and filtering symbols");
  try{
    const symbol = ["USD/EUR", "USD/GBP", "USD/CAD", "USD/CHF", "USD/JPY", "USD/AUD", "USD/NZD"];
    const test = "USD/CAD";
    console.log("Symbols are: ", symbol);
    // First check what is inside the table
    //const result = await db.query("SELECT * FROM symbol");
    //const result = await db.query("SELECT * FROM symbol WHERE (symbol, date) = ($1, $2)", [test, date50days.toISOString()]);
    
    let dateToday = new Date();//what is current date
    console.log("Today is non converted:", dateToday);
    const daysAgo = 50;
    //dateDaysAgo = await daysAgoConversion(daysAgo, dateToday);//get me the date which was xx days ago
    const date50days = new Date(dateToday);
    date50days.setDate(dateToday.getDate()-daysAgo);
    console.log("50 days back is: ", date50days);

    let varA;
    let varB;
    
    for(let i=0; i<symbol.length; i++){
    //for(let i=0; i<1; i++){
      varA = await db.query("SELECT * FROM symbol WHERE (symbol, date) = ($1, $2)", [symbol[i], date50days.toISOString()]);
      //console.log("varA is: ", varA);
      varB = await db.query("SELECT * FROM symbol WHERE (symbol, date) = ($1, $2)", [symbol[i], dateToday.toISOString()]);
      //console.log("varB is: ", varB);

      if (varA.rows.length > 0 && varB.rows.length > 0) {
        console.log(`Result for ${symbol[i]} 50 days ago is:`, varA.rows[0].rate);
        console.log(`Result for ${symbol[i]} today is:`, varB.rows[0].rate);

        let varC = (varB.rows[0].rate - varA.rows[0].rate).toPrecision(2);
        let varD = ((varC / varA.rows[0].rate) * 100).toPrecision(2);
        console.log(`Strength for ${symbol[i]} is: ${varD}%`);
        //save this into second table for chart analysis later on
        await db.query("INSERT INTO calculation (symbol, varc, vard, date) VALUES ($1, $2, $3, $4)", [symbol[i], varC, varD, dateToday]);

      } else {
        console.log(`No data found for ${symbol[i]}`);
      }
    };

    return;
  }catch (error) {
    console.error("Error reading/inserting data into database:", error.stack);
    throw error;
  };
};

//------------------------ FUNCTION ---------------------------------//
//save data from the API endpoint into the database
const saveAPIDataIntoDatabase = async (db, ratesEntries, dateTimestamp) => {
  console.log("Entering into database and trying to save data from the API");
  console.log("symbol, rate, date", ratesEntries[0].s, ratesEntries[0].c, dateTimestamp);

  try{
    
    let dateToday = new Date();//what is current date
    //first read from the database is there something inside
    let varB = await db.query("SELECT * FROM symbol");

    console.log("How many rows are currently in the database:", varB.rows.length);
    //if there is something in the database use the date
    if(varB.rows.length > 0)
    {
      for(let i=0; i<varB.rows.length; i++)
      {
        varB.rows[i].date = await dateConversion(varB.rows[i].date);//change the date format into clean formatting
      }
    }else {
      console.log("There is NOTHING in the database:", varB.length);
    }


    let varL = 0;

    for(let i=0; i<varB.rows.length; i++)
    {
      if(varB.rows[i].date === dateTimestamp)
        varL++;
    };

    console.log("varL is equal to: ", varL);

    if(varL)
    {
      console.log("Not saving new data into database because there is record with current date");
      return;
    }else{
      //if there is no date that is equal today date then proceed and save new data into database
      console.log("Saving data into database because there is no record with today date");
      for(let i=0; i<ratesEntries.length; i++)
      {
        await db.query("INSERT INTO symbol (symbol, rate, date) VALUES ($1, $2, $3)", [ratesEntries[i].s, ratesEntries[i].c, dateTimestamp]);
      };
    };
    return;//return back from the function
  }
  catch (error) {
    console.error("Error inserting data into database:", error.stack);
    throw error;
  };
  
};

//------------------------ FUNCTION ---------------------------------//
const fetchQuizData = async (db,ratesEntries, dateTimestamp) => {
    try {
      console.log("Fetching data...");




      //dateToday = await dateConversion(dateToday);//current date
      //console.log("Today is converted:", dateToday);



      let newDate; // Move the declaration outside the loop

      for(let j=0; j<result.rows.length; j++)
      {
        console.log(`result.rows.date[${j}]:`, result.rows[j].date);
        //check the date in each of the records inside the database 
        newDate = await dateConversionTimestamp(result.rows[j].date);
        //console.log(`result.rows.date[${j}]:`, newDate);
      }

      console.log("entering database:");
      
       // currently commented because I am working on calculations from the database. I do not want to insert anything into the database for now
      // Insert data into the 'symbol' table using parameterized query with all data from the JSON
      for(let i=0; i<result.rows.length; i++)
      //for(let i=0; i<1; i++)// testing with only 1 record
      {
        await db.query("INSERT INTO symbol (symbol, rate, date) VALUES ($1, $2, $3)", [result.rows[0].symbol, varD, dateToday.toISOString()]);
      };
      

      return result.rows;
    } 
    catch (error) {
      console.error("Error fetching or inserting quiz data:", error.stack);
      throw error;
    };
  }
  //------------------------ FUNCTION ---------------------------------//
  const dateConversionTimestamp = async(dates) => {
    try{
      console.log("Timestamp RAW is: ", dates);

      const dateFromTimestamp = new Date(dates *1000);//multiply to get in seconds because current time is in the miliseconds

      console.log("dateFromTimestamp is: ", dateFromTimestamp);
/*
      // Get the year, month (adjusted for zero-index), and day
      const year = dateFromTimestamp.getFullYear();
      const month = dateFromTimestamp.getMonth() + 1; // Add 1 because months are started indexed from 0
      const day = dateFromTimestamp.getDate();

      // Construct the date string in the desired format
      const formattedDate = `${year}-${month}-${day}`;
      console.log("formattedDate:", formattedDate);
      return formattedDate;
      */
     return dateFromTimestamp;
    }catch (error) 
    {
      console.error("Error converting date:", error.stack);
      throw error;
    };
  }

    //------------------------ FUNCTION ---------------------------------//
    const dateConversion = async(dates) => {
      try{
        const dateFromTimestamp = new Date(dates);
        // Get the year, month (adjusted for zero-index), and day
        const year = dateFromTimestamp.getFullYear();
        const month = dateFromTimestamp.getMonth() + 1; // Add 1 because months are started indexed from 0
        const day = dateFromTimestamp.getDate();
  
        // Construct the date string in the desired format
        const formattedDate = `${year}-${month}-${day}`;
        //console.log("formattedDate:", formattedDate);
        return formattedDate;
      }catch (error) 
      {
        console.error("Error converting date:", error.stack);
        throw error;
      };
    }
    //------------------------ FUNCTION ---------------------------------//
    const daysAgoConversion = async(daysAgo, dateToday) => {
      try{
        const currentDateMiliSeconds = new Date();
        
        
        console.log("currentDateMiliSeconds:", currentDateMiliSeconds);
        /*
        // Get the year, month (adjusted for zero-index), and day
        const year = dateFromTimestamp.getFullYear();
        const month = dateFromTimestamp.getMonth() + 1; // Add 1 because months are started indexed from 0
        const day = dateFromTimestamp.getDate();
  
        // Construct the date string in the desired format
        const formattedDate = `${year}-${month}-${day}`;
        console.log("formattedDate:", formattedDate);
        return formattedDate;
        */
        return;
      }catch (error) 
      {
        console.error("Error converting date:", error.stack);
        throw error;
      };
    };
    

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
