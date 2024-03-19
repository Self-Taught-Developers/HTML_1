import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";

import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    //const result = await axios.get(API_URL + yourAPIKey);
    //test
     const result = {
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
          tm: "2024-03-14 05:50:56"
        }
        // Add more records if needed
      ],
      info: {
        server_time: "2024-03-14 05:51:55 UTC",
        credit_count: 20
      }
    };   
     
    
    //console.log("Data from the JSON: ", result.data.info.server_time);
    //test
    console.log("Data from the JSON: ", result.info.server_time);

    //check the date form the JSON from the fcsapi
    //const apiDate = result.data.info.server_time;
    //test
    const apiDate = result.info.server_time;

    const dateTimestamp = await dateConversion(apiDate);
    //const dateTimestamp = apiDate;
    console.log("formattedDate returned:", dateTimestamp);
    
    //save data from the JSON file into object variable
    //const ratesEntries = result.data.response;
    //test
    const ratesEntries = result.response;

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
    const strengthData = await fetchStrengthData(db);

    console.log('Strength Data:', strengthData); // Log the value of strengthData

    //convert database Date into normal date
    if(strengthData.length > 0)
    {
      for(let i=0; i<strengthData.length; i++)
      {
        strengthData[i].date = await dateConversion(strengthData[i].date);//change the date format into clean formatting
       
      };
    }

    // Pass the data to your chart rendering function or template
    console.log("Strength data at the position 0 is", strengthData[0].date);

    let testVar = strengthData;
    //sending data to .ejs file
    res.render("index.ejs", { testVar });


    // Close the database connection after the request is processed
    await db.end();
    console.log("Database connection closed.");
  } catch (error) {
    res.status(404).send(error.message);
  }
});

//------------------------ FUNCTION ---------------------------------//
const fetchStrengthData = async (db) => {
  try {
    console.log("Fetching database strength data for the chart...");
    const strengthData = await db.query("SELECT * FROM strength");

    console.log("Data from the strength database is: ", strengthData.rows[0].varstrength, strengthData.rows[0].date);

    // Format the data into an array of objects with 'date' and 'varstrength' properties
    const chartData = strengthData.rows.map(row => ({
      date: row.date,
      strength: parseFloat(row.varstrength)
    }));

    return chartData;
  } 
  catch (error) {
    console.error("Error fetching data:", error.stack);
    throw error;
  };
}
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

      console.log("Current symbol is: ", symbol[i]);
      console.log("Current i is: ", i);
      console.log("Current varE length is:", varE.rows.length);

      if (varE.rows.length > 0)
      {
        console.log("Current varE.rows[i].vard is: ", varE.rows[0].vard);
        varF += varE.rows[0].vard; //use only first row because there should be only one row for the current date for this symbol and add it to this var that contains all values from other symbols
        console.log("varE length is:", varE.rows.length);
        varH++;
        console.log("Sum of strength is:", varF);
        varG = varF/varH;
        console.log("Average strength is:", varG);
        console.log("varH is:", varH);
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

    const daysAgo = 1; //how many days ago?
    //dateDaysAgo = await daysAgoConversion(daysAgo, dateToday);//get me the date which was xx days ago
    let date50days = new Date(dateToday);
    date50days.setDate(dateToday.getDate()-daysAgo);
    date50days = await dateConversion(date50days);//change the date format into clean formatting
    console.log("xx days back is: ", date50days);

    dateToday = await dateConversion(dateToday);//change the date format into clean formatting
    console.log("Today is converted:", dateToday);

    let varA;
    let varB;
    
    console.log("Symbol length is: ", symbol.length);

    for(let i=0; i<symbol.length; i++){
    //for(let i=0; i<1; i++){
      varA = await db.query("SELECT * FROM symbol WHERE (symbol, date) = ($1, $2)", [symbol[i], date50days]);
      
      varB = await db.query("SELECT * FROM symbol WHERE (symbol, date) = ($1, $2)", [symbol[i], dateToday]);
      
      console.log("varA is: ", varA.rows);
      console.log("varB is: ", varB.rows);
      
      if (varA.rows.length > 0 && varB.rows.length > 0) {
        console.log(`Result for ${symbol[i]} 50 days ago is:`, varA.rows[0].rate);
        console.log(`Result for ${symbol[i]} today is:`, varB.rows[0].rate);

        let varC = (varB.rows[0].rate - varA.rows[0].rate).toPrecision(2);
        let varD = ((varC / varA.rows[0].rate) * 100).toPrecision(2);
        console.log(`Strength for ${symbol[i]} is: ${varD}%`);
        //save this into second table for chart analysis later on
        await db.query("INSERT INTO calculation (symbol, varc, vard, date) VALUES ($1, $2, $3, $4)", [symbol[i], varC, varD, dateToday]);

      } else {
        console.log(`No data found for 50daysago and for today for a symbol: ${symbol[i]}`);
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

    //function to calculate how many records in the database are the same as the current date
    let dateInDatabase = await checkDateRecords(varB, dateTimestamp);

    if(dateInDatabase)
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
//read dates from the database and compare them with the current date. Return something if there are records with the current date
const checkDateRecords = async(databaseRecords, dateTimestamp) => {
  try{
    let varL = 0; //variable for calculating how many records are in the database with the current date
    console.log("Entering into function to check are the dates from the database equal to current date");
    console.log("databaseRecords.rows.length is: ", databaseRecords.rows.length);
    //if there is something in the database use the date
    if(databaseRecords.rows.length > 0)
    {
      for(let i=0; i<databaseRecords.rows.length; i++)
      {
        databaseRecords.rows[i].date = await dateConversion(databaseRecords.rows[i].date);//change the date format into clean formatting

        //check how many dates in the database are the same as current date
        if(databaseRecords.rows[i].date === dateTimestamp)
        {
          varL++;
        };        
      };
    }else {
      console.log("There is NOTHING in the database:", varB.length);
    };

    console.log("varL is equal to: ", varL);

    return varL;
  }
  catch (error){
    console.error("Error reading dates from the database:", error.stack);
    throw error;
  };
};


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
