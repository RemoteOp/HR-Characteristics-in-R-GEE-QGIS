Map.centerObject(AOI, 7);

var AOIVis = AOI.style({color: "006400" , width: 1, fillColor: "FFFFFF00"});
Map.addLayer(AOIVis, null, "Home Range");



//**TEMPORAL REDUCERS**//

/**Calculating total rainfall (sum) in study period and long-term ave. (2000-2015) **/

//Get CHIRPS collection: selecting precipitation band and filter by AOI
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
                  .select('precipitation')
                  .filterBounds(AOI);

//Calculating total rainfall in study period
var chirps_StudyPeriod = chirps
                  .filter(ee.Filter.date('2015-03-15', '2018-07-31')) 
                  .sum() 
                  .clip(AOI); 


//Calculating long-term average total 

var chirps_baseline = chirps.filter(ee.Filter.dayOfYear(1,365)); 

// baseline period
var years = ee.List.sequence(2000, 2015);

var chirps_baseline_lt = ee.ImageCollection.fromImages(
        years.map(function (y) {
          return chirps_baseline
                    .filter(ee.Filter.calendarRange(y, y, 'year'))
                    .sum()
                    .set('year', y);
      })).mean().clip(AOI); 

//visualisation parameters for rainfall layers 
var precipitationVis = {
  min: 150,
  max: 500.0,
  palette: ['#f1eef6', '#bdc9e1', '#74a9cf', '#2b8cbe', '#045a8d']
};

//Adding layer showing long term average precipitation  
Map.addLayer(chirps_baseline_lt, precipitationVis, 'Average total precipitation (2000-2015)');

//Adding layer showing total rainfall in studyperiod
Map.addLayer(chirps_StudyPeriod, precipitationVis, 'Total precipitation (2015-2018)');
Map.centerObject(AOI);


//**SPATIAL REDUCERS**//

// Selecting relevant spatial reducers
var reducers_all = ee.Reducer.mean()
                             .combine(ee.Reducer.min(), null, true)
                             .combine(ee.Reducer.max(), null, true);

// Using the combined reducer to calculate the stats on the image.
var chirps_StudyPeriod_stats = chirps_StudyPeriod.reduceRegions({
  collection: AOI,
  reducer: reducers_all
});

// Displaying the stats in the Console
print(chirps_StudyPeriod_stats);

//Exporting stats to Google Drive as CSV
Export.table.toDrive({
  collection: chirps_StudyPeriod_stats,
  description: "Rainfall in study period",
  fileFormat: 'CSV',
  selectors: ["NAME", "mean","min","max"]
});
