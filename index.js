const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { google } = require("googleapis");
const path = require("path");

const app = express();
const jsonParser = bodyParser.json();

app.use(cors());
app.listen(80, function () {
  console.log("api running");
});

const spreadsheetId = "19UD2hi6sYo8E8U8Xmp5fqqbm1ZdYLxHKWkPV6eWQK0M";

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve("./api/credentials.json"),
  scopes: "https://www.googleapis.com/auth/spreadsheets"
});

const getGoogleSheets = async () => {
  const client = await auth.getClient();

  const googleSheets = google.sheets({ version: "v4", auth: client });
  return googleSheets;
};

app.get("/getHouses", jsonParser, async (_, res) => {
  const googleSheets = await getGoogleSheets();

  const rows = await googleSheets.spreadsheets.values.batchGet({
    auth,
    spreadsheetId,
    ranges: "Hoja 1"
  });

  const { values } = rows?.data?.valueRanges[0] ?? {};

  const houses = values.map(
    ([price, title, location, feature, image, link, date, type]) => ({
      price,
      title,
      location,
      feature,
      image,
      link,
      date,
      type
    })
  );

  const results = houses.reduce((prev, current) => {
    (prev[current.link] = prev[current.link] || []).push(current);
    return prev;
  }, {});

  let filteredHouses = Object.values(results).map((item) => {
    const pricesWithDate = item.map(({ price, date }) => {
      return {
        price,
        date
      };
    });
    const prices = item.map(({ price }) => price);

    const pricesFiltered = pricesWithDate.filter(
      ({ price }, index) => !prices.includes(price, index + 1)
    );

    const priceChanges =
      pricesFiltered.at(0)?.price - pricesFiltered?.at(-1)?.price;

    return {
      ...item[0],
      price: pricesFiltered.sort((a, b) => a.date - b.date),
      priceChanges
    };
  });

  filteredHouses = filteredHouses
    .filter(({ priceChanges }) => priceChanges > 0)
    .sort((a, b) => b.priceChanges - a.priceChanges);

  res.send({
    status: "Success",
    houses: filteredHouses,
    count: filteredHouses.length
  });
});
