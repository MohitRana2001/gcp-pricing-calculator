
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const csvFilePath = path.resolve(__dirname, '../machine-types-regions.csv');
const jsonFilePath = path.resolve(__dirname, '../public/data/machine-data.json');

const results = [];

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    fs.writeFile(jsonFilePath, JSON.stringify(results, null, 2), (err) => {
      if (err) {
        console.error('Error writing JSON file:', err);
      } else {
        console.log('Successfully converted CSV to JSON');
      }
    });
  });
