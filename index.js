var googleMapsClient = require('@google/maps').createClient({
	key: ''
});
var util = require('util');
var fs = require('fs');
var prependFile = require('prepend-file');

var size = 512; //n step width x n step width. 2^n
var earthRadius = 6378.137 * 1000; // km * 1000 = meters
var chunkSize = 128;
var zoomLevel = 16;
var pixelsAtEquator = 256 * Math.pow(2, zoomLevel);
var metersPerPixel = 2 * Math.PI * earthRadius / pixelsAtEquator;
var imageSize = 640;
var zoomWidth = imageSize * metersPerPixel;
var stepWidth = Math.round(100000 * zoomWidth / size) / 100000;

var minHeight = Infinity;
var maxHeight = -Infinity;
var north = -Infinity;
var east = -Infinity;
var south = Infinity;
var west = Infinity;

// If the query fails, manually enter the last percentage that was output to log. The script will pick up where it left off.
var totalQueryPosition = 0;//75.20823125918668 + (1 / size);

googleMapsClient.geocode({
	address: '43.012723, -83.712156'
}, function(err, response) {
	if(!err) {
		var locationData = response.json.results[0].geometry.location;
		
		var latitudeList = getLatitudeData(locationData).sort();
		var longitudeList = getLongitudeData(locationData).sort();
		
		getElevationData(latitudeList, longitudeList);
	}
});

function getLatitudeData(data) {
	var radius = size / 2;
	var degDistance = 1;
	var center = parseFloat(data.lat);
	var lng = parseFloat(data.lng);
	var latitudeData = [center];
	var lastLatitude = center;
	
	// North
	for(var i = 0; i < radius; i++) {
		var distance;
		
		do {
			distance = Math.round(1000000 * Haversine(lastLatitude, lng, lastLatitude + degDistance, lng, earthRadius)) / 1000000;
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		latitudeData.push(Math.round(1000000 * (lastLatitude + degDistance)) / 1000000);
		
		lastLatitude += degDistance;
		
		north = lastLatitude;
	}
	
	lastLatitude = center;
	
	// South
	for(var i = 0; i < radius; i++) {
		var distance;
		
		do {
			distance = Math.round(1000000 * Haversine(lastLatitude, lng, lastLatitude - degDistance, lng, earthRadius)) / 1000000;
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		latitudeData.push(Math.round(1000000 * (lastLatitude - degDistance)) / 1000000);
		
		lastLatitude -= degDistance;
		
		south = lastLatitude;
	}
	
	return latitudeData;
}

function getLongitudeData(data) {
	var radius = size / 2;
	var degDistance = 1;
	var center = parseFloat(data.lng);
	var lat = parseFloat(data.lat);
	var longitudeData = [center];
	var lastLongitude = center; 
	
	// East
	for(var i = 0; i < radius; i++) {
		var distance;
		
		do {
			distance = Math.round(1000000 * Haversine(lat, lastLongitude, lat, lastLongitude + degDistance, earthRadius)) / 1000000;
			
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		longitudeData.push(Math.round(1000000 * (lastLongitude + degDistance)) / 1000000);
		
		lastLongitude += degDistance;
		
		east = lastLongitude;
	}
	
	lastLongitude = center;
	
	// West
	for(var i = 0; i < radius; i++) {
		var distance;
		
		do {
			distance = Math.round(1000000 * Haversine(lat, lastLongitude, lat, lastLongitude - degDistance, earthRadius)) / 1000000;
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		longitudeData.push(Math.round(1000000 * (lastLongitude - degDistance)) / 1000000);
		
		lastLongitude -= degDistance;
		
		west = lastLongitude;
	}
	
	return longitudeData;
}

function getElevationData(lat, lng) {
	var coordinates = [];
	var query = [];
	var count = 0;
	var queryIndex = 0;
	
	for(var i = 0; i < lat.length; i++) {
		for(var j = 0; j < lng.length; j++) {
			coordinates.push({lat: lat[i], lng: lng[j]});
			query[queryIndex] = (query[queryIndex] == undefined ? "" : query[queryIndex] + "|") + lat[i] + "," + lng[j];
			count++;
			
			if(count > chunkSize) {
				queryIndex++;
				count = 0;
			}
		}
	}
	
	if(totalQueryPosition == 0) {
		fs.writeFileSync('./terrainData.data', '', 'utf-8');
	}
	
	var doneIndex = 0;
	
	queryElevation(0, query);
}

function queryElevation(index, query) {
	if(100 * (index + 1) / query.length > totalQueryPosition) {
		googleMapsClient.elevation({
			locations: query[index]
		}, function(err, response) {
			if(!err) {
				
				var appendData = formatOutput(response.json.results);
				
				for(var resultIndex = 0; resultIndex < response.json.results.length; resultIndex++) {
					if(parseFloat(response.json.results[resultIndex].elevation) > maxHeight) {
						maxHeight = parseFloat(response.json.results[resultIndex].elevation);
					}
					if(parseFloat(response.json.results[resultIndex].elevation) < minHeight) {
						minHeight = parseFloat(response.json.results[resultIndex].elevation);
					}
				}
				
				fs.appendFile('./terrainData.data', appendData, function(err) {
					if(err) throw err;
					
					console.log(100 * (++index) / query.length + "%");
					
					if(index === query.length) {
						var prependData = "minHeight " + minHeight + "f\n"
							+ "maxHeight " + maxHeight + "f\n"
							+ "north " + north + "f\n"
							+ "east " + east + "f\n"
							+ "south " + south + "f\n"
							+ "west " + west + "f\n";
						
						prependFile('./terrainData.data', prependData, function(err) {
							if(err) {
								throw err;
							}
							
							console.log("Queries complete.");
						});
					} else {
						queryElevation(index, query);
					}
				});
				
			}
		});
	} else {
		queryElevation(++index, query);
	}
}

function formatOutput(input) {
	var output = "";
	
	for(var i = 0; i < input.length; i++) {
		output += input[i].elevation + "f "
			+ input[i].location.lat + "f "
			+ input[i].location.lng + "f\n"
	}
	
	return output;
}

function Haversine(lat1, lng1, lat2, lng2, R) {
	var phi1 = lat1 * Math.PI / 180;
	var phi2 = lat2 * Math.PI / 180;
	var lam1 = lng1 * Math.PI / 180;
	var lam2 = lng2 * Math.PI / 180;
	
	var dPhi = phi2 - phi1;
	var dLam = lam2 - lam1;
	
	var a8 = dLam / 2;
	var a7 = dPhi / 2;
	var a6 = Math.sin(a8);
	var a5 = Math.sin(a7);
	var a4 = Math.pow(a6, 2);
	var a3 = Math.cos(phi2);
	var a2 = Math.cos(phi1);
	var a1 = Math.pow(a5, 2);
	var a0 = a1 + a2 * a3 * a4;
	
	var c2 = Math.sqrt(a0);
	var c1 = Math.asin(c2);
	var c0 = 2 * c1;
	
	return R * c0;
}
