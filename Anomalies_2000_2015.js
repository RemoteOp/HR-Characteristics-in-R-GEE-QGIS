//charting period
var startYear = 2015;
var endYear = 2018;
var startMonth = 01;
var endMonth = 12;

//baseline peiord 
var b_start = "2000-01-01";
var b_end = "2015-02-28";

//start and end day numbers of the year that will be used for calculating the baseline,

var bm_start = 1;
var bm_end = 365;

var anom_start = "2015-03-01";
var anom_end = "2018-07-31";

//date range for filtering Landsat collection
var f_start = '2000-01-01';
var f_end = '2018-07-31';



// Landsat 7 surface reflectance (SR) collection
var dataset = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
                  .filterDate(f_start, f_end)
                  .filterBounds(HR_AOI);

print(dataset.first(),"dataset");


//**** Defining and applying functions****//

//Masking surface reflectance images**//
function prepSrL8(image) {
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Applying the scaling factors to the appropriate bands.
  var getFactorImg = function(factorNames) {
    var factorList = image.toDictionary().select(factorNames).values();
    return ee.Image.constant(factorList);
  };
  var scaleImg = getFactorImg([
    'REFLECTANCE_MULT_BAND_.|TEMPERATURE_MULT_BAND_ST_B6']);
  var offsetImg = getFactorImg([
    'REFLECTANCE_ADD_BAND_.|TEMPERATURE_ADD_BAND_ST_B6']);
  var scaled = image.select('SR_B.|ST_B6').multiply(scaleImg).add(offsetImg);

  // Replacing original bands with scaled bands and applying masks.
  return image.addBands(scaled, null, true)
    .updateMask(qaMask).updateMask(saturationMask);
}

//** Calculating NDVI in vegetated areas**//
var lc = ee.ImageCollection('ESA/WorldCover/v200').first().clip(HR_AOI);
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI')
                 .updateMask(lc.eq(10).or(lc.eq(20)).or(lc.eq(30)));
  return image.addBands(ndvi);
};

//** Applying functions on filtered image collection**//
var cloudmasked = dataset.map(prepSrL8); 
var withNDVI = cloudmasked.map(addNDVI);

//Creating new filtered collection covering only baseline period
var withNDVI_baseline = withNDVI.filterDate(b_start, b_end); 

//**** Calculate monthly anomalies****//
var years = ee.List.sequence(startYear, endYear);
var months = ee.List.sequence(startMonth, endMonth);

// Defining a function to compute the anomaly for a given month.
var computeAnomaly = function(image) {
  var year = image.date().get('year');
  var month = image.date().get('month');
  var referenceImage = meanMonthlyNDVI.filter(
      ee.Filter.eq('month', month)).first();
  var hasBands = image.bandNames().size().gt(0);
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


//**** Develop NDVI anomaly graph****//

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


//****Converting data to table****
//convert monthly mean values for period of interest to table

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


//**** Visuliase image and exporting data to Google Drive****//
Map.addLayer(anomaly_HR, anom_vis, "NDVI anomaly HR");
Map.centerObject(HR_AOI);

Export.table.toDrive({
  collection: meanByMonth,
  description: "Sanitaka_mean_monthly_ndvi",
  fileFormat: 'CSV',
  selectors: ["year","month", "NDVI"] 
});

//exporting geotiff for anomaly at 100m res
Export.image.toDrive({
  image: anomaly_HR,
  description: 'NDVI anomaly, 2015-2018',
  maxPixels:  3230585632,
  region: HR_AOI,
  scale: 100
});
