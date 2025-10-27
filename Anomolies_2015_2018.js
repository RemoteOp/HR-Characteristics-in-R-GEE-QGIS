//******Calculating NDVI anomaly image for specific date and chart monthly anomalies over time*****

//****Importing image collection, filter by date and defining study period****//

// start and end months/years for charting period
var startYear = 2015;
var endYear = 2018;
var startMonth = 01;
var endMonth = 12;

// start and end dates for baseline peiord (from which anomalies will be calculated)
var b_start = "2018-08-01";
var b_end = "2025-06-30";

// selecting start and end day numbers of the year that will be used for calculating the baseline;
// selecting specific dates for the study period for calculating anomaly 

var bm_start = 1;
var bm_end = 365;

var anom_start = "2015-03-01";
var anom_end = "2018-07-31";

// Selecting date range for filtering Landsat collection
var f_start = '2015-01-01';
var f_end = '2025-06-30';

// Importing and filtering Landsat 8 surface reflectance (SR) collection
var dataset = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2") 
                  .filterDate(f_start, f_end)
                  .filterBounds(HR_AOI);

print(dataset.first(),"dataset");


//**** Defining and applying functions****//

//**Define function to scale and mask surface reflectance images**//
// Uses QA_PIXEL and QA_RADST bands to mask out clouds and cloud shadow. 
// Scaling converts data back to floating point data type

function prepSrL8(image) {
  // Developing masks for unwanted pixels (fill, cloud, cloud shadow).
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Applying the scaling factors to the appropriate bands.
  var getFactorImg = function(factorNames) {
    var factorList = image.toDictionary().select(factorNames).values();
    return ee.Image.constant(factorList);
  };
  var scaleImg = getFactorImg([
    'REFLECTANCE_MULT_BAND_.|TEMPERATURE_MULT_BAND_ST_B10']);
  var offsetImg = getFactorImg([
    'REFLECTANCE_ADD_BAND_.|TEMPERATURE_ADD_BAND_ST_B10']);
  var scaled = image.select('SR_B.|ST_B10').multiply(scaleImg).add(offsetImg);

  // Replacing original bands with scaled bands and applying masks.
  return image.addBands(scaled, null, true)
    .updateMask(qaMask).updateMask(saturationMask);
}

//** Defining function to calculate NDVI in vegetated areas**//
var lc = ee.ImageCollection('ESA/WorldCover/v200').first().clip(HR_AOI);
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI')
                 .updateMask(lc.eq(10).or(lc.eq(20)).or(lc.eq(30)));
  return image.addBands(ndvi);
};

//** Applying functions on filtered image collection**//
var cloudmasked = dataset.map(prepSrL8); //applying cloud mask/scaling function 
var withNDVI = cloudmasked.map(addNDVI); //applying NDVI function 
//print(withNDVI,"withNDVI");

//Creating new filtered collection covering only baseline period
var withNDVI_baseline = withNDVI.filterDate(b_start, b_end); 


//**** Calculating monthly anomalies****//

var years = ee.List.sequence(startYear, endYear);
var months = ee.List.sequence(startMonth, endMonth);

// Defining a function to compute the anomaly for a given month.
var computeAnomaly = function(image) {
  // Getting the month of the image.
  var year = image.date().get('year');
  var month = image.date().get('month');
  // Getting the corresponding reference image for the month.
  var referenceImage = meanMonthlyNDVI.filter(
      ee.Filter.eq('month', month)).first();
  // Checking if the images have bands
  var hasBands = image.bandNames().size().gt(0);
  // Computing the anomaly by subtracting reference image from input image.
  var anomalyImage = ee.Algorithms.If(
    hasBands,
    ee.Algorithms.If(
  referenceImage.bandNames().size().gt(0),
  image.subtract(referenceImage),
  image
),
    image
);
  
return ee.Image(anomalyImage).set({
    'system:time_start': ee.Date.fromYMD(year, month, 1).millis(),
    'year': year,
    'month': month
  });
};


// Calculating monthly average NDVI over full period
var monthlyNDVI =  ee.ImageCollection.fromImages(
  years.map(function(y) {
    return months.map(function(m) {
      var filtered = withNDVI
                          .select("NDVI")
                          .filter(ee.Filter.calendarRange(y, y, 'year'))
                          .filter(ee.Filter.calendarRange(m, m, 'month'))
                          .mean();
      return filtered.set({
        'month': m,
        'system:time_start': ee.Date.fromYMD(y, m, 1).millis()
      });
    });
  }).flatten()
);
print(monthlyNDVI,"Monthly NDVI")

var emptyMonths = monthlyNDVI
  .filter(ee.Filter.eq('bandNames', []))
  .aggregate_array('system:time_start')
  .map(function(ms) {
    return ee.Date(ms).format('YYYY-MM');
  });

print('Months with empty NDVI:', emptyMonths);

// Calculating monthly average NDVI across baseline period
var meanMonthlyNDVI = ee.ImageCollection.fromImages(
  ee.List.sequence(1, 12).map(function(m) {
    var filtered = monthlyNDVI
    .filterDate(b_start, b_end)
    .filter(ee.Filter.eq('month', m)).mean();
    return filtered.set('month', m);
  })
);

// Mapping the function over the monthly precipitation collection to compute
// the anomaly precipitation for each month.
var monthlyNDVIAnomalies = monthlyNDVI.map(
    computeAnomaly);
    
print(monthlyNDVIAnomalies,"monthly NDVI anomalies");


//****STEP 4: Developing NDVI anomaly graph****//

var chart =
  ui.Chart.image.series({
      imageCollection: monthlyNDVIAnomalies,
      region: HR_AOI,
      scale: 100,
      xProperty: 'system:time_start'
    })
    .setSeriesNames(['NDVI anomaly'])
    .setOptions({
      title: 'Monthly NDVI anomaly',
      series: {
        0: {
            targetAxisIndex: 0, type: 'line', lineWidth: 3,
            pointSize: 1, color: '#ffc61a'
        },
        1: {
            targetAxisIndex: 0, type: 'line', lineWidth: 3, pointSize: 1,
            lineDashStyle: [2, 2], color: '#330000'
        },
        2: {
            targetAxisIndex: 1, type: 'line', lineWidth: 3, pointSize: 1,
            lineDashStyle: [4, 4], color: '#1a1aff'
        },
      },
      hAxis: {
        title: 'Date',
        titleTextStyle: {italic: false, bold: true}
      },
      vAxes: {
        0: {
            title: 'NDVI anomaly',
            baseline: 0, titleTextStyle: {bold: true, color: '#1a1aff'},
            //viewWindow: {min: -0.3, max: 0.3}
        }
      },
      curveType: 'function'
    });

print(chart);



//**** Convert data to table****
// converting monthly mean values for period of interest to table

var meanByMonth = monthlyNDVIAnomalies.map(function(image) {
  var meanDict = image.reduceRegion({
    geometry: HR_AOI,
    reducer: ee.Reducer.mean(),
    scale: 100
  });
  return ee.Feature(null, meanDict).set('year', image.get('year')).set('month', image.get('month'));
});

print("meanByMonth", meanByMonth);



//**** Calculate NDVI anomaly image ****//
var baseline = withNDVI_baseline.select("NDVI").filter(ee.Filter.dayOfYear(bm_start,bm_end)).mean();

var HR_mean = withNDVI.filterDate(anom_start, anom_end)
    .qualityMosaic("NDVI").clip(HR_AOI);

var anomaly_HR = HR_mean.select("NDVI").subtract(baseline);
var anom_vis = {min: -0.1, max: 0.1, palette: ['FF0000', '000000', '00FF00']};

//**** Visuliase image and export data to Google Drive****//
Map.addLayer(anomaly_HR, anom_vis, "NDVI anomaly HR");
Map.centerObject(HR_AOI);

Export.table.toDrive({
  collection: meanByMonth,
  description: "Sanitaka_mean_monthly_ndvi_2018_2025",
  fileFormat: 'CSV',
  selectors: ["year","month", "NDVI"] 
});


// Exporting geotiff for anomaly at 100m res
Export.image.toDrive({
  image: anomaly_HR,
  description: 'NDVI_anomaly_2018_2025',
  maxPixels:  3230585632,
  region: HR_AOI,
  scale: 100
});
