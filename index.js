var googleMapsClient = require('@google/maps').createClient({
	key: ''
});
var util = require('util');
var fs = require('fs');

var size = 256; //n step width x n step width. 2^n
var earthRadius = 6378.137 * 1000; // km * 1000 = meters
var chunkSize = 128;
var stepWidth = 9.54395;//1988220215; // meter

googleMapsClient.geocode({
	address: ''
}, function(err, response) {
	if(!err) {
		var locationData = response.json.results[0].geometry.location;
		
		var latitudeList = getLatitudeData(locationData).sort();
		var longitudeList = getLongitudeData(locationData).sort();
		
		getElevationData(latitudeList, longitudeList);
	}
});

function getLatitudeData(data) {console.log("\n\n\n\n\n\n\n\n\n\ngetLatitudeData");
	var radius = size / 2;
	var degDistance = 1;
	var center = parseFloat(data.lat);
	var lng = parseFloat(data.lng);
	var latitudeData = [center];
	var lastLatitude = center;
	
	// North
	for(var i = 0; i < radius; i++) {console.log(50 * (i + 1) / radius + "%");
		var distance;
		
		do {
			distance = Math.round(100000 * Haversine(lastLatitude, lng, lastLatitude + degDistance, lng, earthRadius)) / 100000;
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		latitudeData.push(lastLatitude + degDistance);
		
		lastLatitude += degDistance;
	}
	
	lastLatitude = center;
	
	// South
	for(var i = 0; i < radius; i++) {console.log(50 + 50 * (i + 1) / radius + "%");
		var distance;
		
		do {
			distance = Math.round(100000 * Haversine(lastLatitude, lng, lastLatitude - degDistance, lng, earthRadius)) / 100000;//console.log("!!", distance, degDistance);
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		latitudeData.push(lastLatitude - degDistance);
		
		lastLatitude -= degDistance;
	}
	
	return latitudeData;
}

function getLongitudeData(data) {console.log("\n\n\n\n\n\n\n\n\n\ngetLongitudeData");
	var radius = size / 2;
	var degDistance = 1;
	var center = parseFloat(data.lng);
	var lat = parseFloat(data.lat);
	var longitudeData = [center];
	var lastLongitude = center; 
	
	// East
	for(var i = 0; i < radius; i++) {console.log(50 * (i + 1) / radius + "%");
		var distance;
		
		do {
			distance = Math.round(100000 * Haversine(lat, lastLongitude, lat, lastLongitude + degDistance, earthRadius)) / 100000;//console.log("!!!", distance, degDistance);
			
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		longitudeData.push(lastLongitude + degDistance);
		
		lastLongitude += degDistance;
	}
	
	lastLongitude = center;
	
	// West
	for(var i = 0; i < radius; i++) {console.log(50 + 50 * (i + 1) / radius + "%");
		var distance;
		
		do {
			distance = Math.round(100000 * Haversine(lat, lastLongitude, lat, lastLongitude - degDistance, earthRadius)) / 100000;
			degDistance /= distance;
			degDistance *= stepWidth;
		} while(distance !== stepWidth);
		
		longitudeData.push(lastLongitude - degDistance);
		
		lastLongitude -= degDistance;
	}
	
	return longitudeData;
}

function getElevationData(lat, lng) {console.log("\n\n\n\n\n\n\n\n\n\ngetElevationData");
	var coordinates = [];
	var query = [];
	var count = 0;
	var queryIndex = 0;
	var responseIndex = 0;
	var output = [];
	var outputIndex = 0;
	
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
	
	fs.writeFileSync('./terrainData.data', '', 'utf-8');
	
	var doneIndex = 0;
	
	for(var index = 0; index < query.length; index++) {
		
		googleMapsClient.elevation({
			locations: query[index]
		}, function(err, response) {
			var oIndex = outputIndex;
			outputIndex++;
			if(!err) {
				
				var appendData = formatOutput(response.json.results) + ',\n';
				fs.appendFile('./terrainData.data', appendData, function(err) {
					if(err) throw err;
					
					console.log(100 * (++doneIndex) / query.length + "%");
				});
				
			}
		});
	}
}

function formatOutput(input) {
	var output = "";
	
	for(var i = 0; i < input.length; i++) {
		if(output != "") {
			output += ",\n";
		}
		output += "new TerrainData("
			+ input[i].elevation + "f, "
			+ "new Location(" + input[i].location.lat + "f, " + input[i].location.lng + "f), "
			+ input[i].resolution + "f)"
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
