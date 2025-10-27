install.packages("sf", dependencies = TRUE)
install.packages("terra", dependencies = TRUE)
install.packages("tmap")

library(adehabitatHR)
library(sf)
library(tmap)
library(sp)

setwd("C:/Users/saral/Udemy_courses/GIS_Remote_Sensing_Conservation_Advanced/Final_Assign")
Parameters <- read.csv("HRParameter.csv")

GPSdata <- read.csv("Sanikata_wet.csv") 

GPSdata_clean <- GPSdata[!is.na(GPSdata$UTM_x) & !is.na(GPSdata$UTM_y), ]

x = GPSdata_clean$UTM_x
y = GPSdata_clean$UTM_y
xy = cbind(x, y)
xysp <- SpatialPoints(xy)

if (Parameters$Method == "MCP") {
  hr_mcp_wet <- mcp(xysp,percent=Parameters$Percentage)
  area_mcp_wet <- mcp.area(xysp,percent=Parameters$Percentage, unin = c("m"), unout = c("ha"))
  
  hr_mcp_sf <- st_as_sf(hr_mcp_wet)
  st_write(hr_mcp_sf, "HR_mcp_wet.shp", driver = "ESRI Shapefile")
  
  
  resultsTable <- rbind(area_mcp_wet$a)
  colnames(resultsTable) <- "Area"
  write.csv(resultsTable, "HR_mcp_wet.csv")
  
  jpeg(file="HR_mcp_wet.jpeg")
  plot(xy,col="red")
  plot(hr_mcp_wet,add=TRUE)
  dev.off()
}

