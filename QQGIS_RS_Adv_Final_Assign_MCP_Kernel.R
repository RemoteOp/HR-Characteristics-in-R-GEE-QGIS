install.packages("sf", dependencies = TRUE)
install.packages("terra", dependencies = TRUE)
install.packages("tmap")

library(adehabitatHR)
library(sf)
library(tmap)
library(sp)

setwd("C:/Users/saral/Udemy_courses/GIS_Remote_Sensing_Conservation_Advanced/Final_Assign")
Parameters <- read.csv("HRParameter.csv")

GPSdata <- read.csv("Sanikata.csv") 

GPSdata_clean <- GPSdata[!is.na(GPSdata$UTM_x) & !is.na(GPSdata$UTM_y), ]

x = GPSdata_clean$UTM_x
y = GPSdata_clean$UTM_y
xy = cbind(x, y)
xysp <- SpatialPoints(xy)

# MCP Method

if (Parameters$Method == "MCP") {
  hr_mcp <- mcp(xysp,percent=Parameters$Percentage)
  area_mcp <- mcp.area(xysp,percent=Parameters$Percentage, unin = c("m"), unout = c("ha"))
  
  hr_mcp_sf <- st_as_sf(hr_mcp)
  st_write(hr_mcp_sf, "HR_mcp.shp", driver = "ESRI Shapefile")
  
  
  resultsTable <- rbind(area_mcp$a)
  colnames(resultsTable) <- "Area"
  write.csv(resultsTable, "HR_mcp.csv")
  
  jpeg(file="HR_mcp.jpeg")
  plot(xy,col="red")
  plot(hr_mcp,add=TRUE)
   dev.off()
}

# KERNEL DENSITY METHOD

if (Parameters$Method == "kernelUD") {
  href_kd <- kernelUD(xysp, h="href", grid = 300, extent = 10)
  hr_kd <- getverticeshr(href_kd, percent=Parameters$Percentage, unout = c("ha"))
  
  hr_kd_sf <- st_as_sf(hr_kd)
  st_write(hr_kd_sf, "HR_kd.shp", driver = "ESRI Shapefile", append = TRUE)
  
  resultsTable <- rbind(hr_kd$area)
  colnames(resultsTable) <- "Area"
  write.csv(resultsTable, "HR_KD.csv")
  
  jpeg(file="HR_KD.jpeg")
  plot(xy,col="red")
  plot(hr_kd,add=TRUE)
  dev.off()
  
  # CONTOUR MAPPING

  par(mfrow=c(1,2))
  par(mar=c(0,0,2,0))
  
  image(href_kd)
  xyz <- as.image.SpatialGridDataFrame(href_kd)
  contour(xyz, add=TRUE)
  
  par(mar=c(0,0,2,0))
  vud <- getvolumeUD(href_kd)
  image(vud)
  xyzv <- as.image.SpatialGridDataFrame(vud)
  contour(xyzv, add=TRUE)
  
  hr95_kd <- as.data.frame(vud)
  
  ii <- kernel.area(href_kd, percent=seq(50, 95, by=5), unout = c("ha"))
}



