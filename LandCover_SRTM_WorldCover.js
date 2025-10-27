var kenya = countries.filter(ee.Filter.eq("ADM0_NAME", "Kenya"));

var kenyaVis = kenya.style({color: "FF4500" , width: 1, fillColor: "FFFFFF00"});

Map.centerObject(kenya);

var pasVis = pas.style({color: "#2F4F4F" , width: 1, fillColor: "FFFFFF00"});

var lc = ee.ImageCollection('ESA/WorldCover/v200').first();

var lc_Kenya = lc.clip(kenya)

var lcVis = {
  bands: ['Map'],
};

var water_kenya = lc_Kenya.updateMask(lc_Kenya.eq(80))


var gfc = ee.Image('UMD/hansen/global_forest_change_2024_v1_12');
var treeCoverVisParam = {
  bands: ['treecover2000'],
  min: 0,
  max: 100,
  palette: ['000000', 'green']
};
Map.addLayer(gfc.mask(gfc), treeCoverVisParam, 'tree cover 2000');

var treeLossVisParam = {
  bands: ['lossyear'],
  min: 0,
  max: 24,
  palette: ['yellow', 'red']
};
Map.addLayer(gfc, treeLossVisParam, 'tree loss year');

var tree_loss = {
  bands: ['loss'],
  min: 0,
  max: 1,
  palette: ['000000', 'red']
};
Map.addLayer(gfc.mask(gfc), tree_loss, 'tree_loss');

var tree_gain = {
  bands: ['gain'],
  min: 0,
  max: 1,
  palette: ['000000', 'purple']
};
Map.addLayer(gfc.mask(gfc), tree_gain, 'tree_gains');


Map.addLayer(lc_Kenya, lcVis, 'Landcover');
Map.addLayer(water_kenya, lcVis, 'Waterbodies');
Map.addLayer(pasVis, null, "Protected areas");
Map.addLayer(kenyaVis, null, "Kenya");


Export.image.toDrive({
  image: gfc.select('lossyear','loss','gain','treecover2000'), 
  description: 'gfc_kenya',
  region: kenya,
  scale: 250 
});

Export.image.toDrive({
  image: lc_Kenya, 
  description: 'lc_kenya',
  region: kenya,
  scale: 250 
});

Export.image.toDrive({
  image: water_kenya, 
  description: 'water_kenya',
  region: kenya,
  scale: 250 
});

Export.table.toDrive({
  collection: kenya,
  description: "kenya",
  fileFormat: 'SHP',
  selectors: ["ADM0_NAME"]
});

Export.table.toDrive({
  collection: pas,
  description: "kenya_pas",
  fileFormat: 'SHP',
});


Export.image.toDrive({
  image: gfc.select('treecover2000'), 
  description: 'gfc_tree',
  region: kenya,
  scale: 250 
});

//Defining visualisation parameters for srtm (Raster)
var srtmVis = {
  min: 0,
  max: 3000,
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};

var srtm_kenya = srtm.clip(kenya)

Map.addLayer(srtm_kenya, srtmVis, "SRTM Elevation");
