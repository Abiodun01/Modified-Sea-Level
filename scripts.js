
// Create the Leaflet map and set its initial center and zoom level
const map = L.map("map").setView([6.5244, 3.3792], 10);

// Create an OpenStreetMap base layer and add it to the map
const OSM = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "&copy; OpenStreetMap contributors", // Map credit
    maxZoom: 22, // Maximum zoom level
  }
).addTo(map); // Adds this layer to the map by default

// Create a satellite imagery layer from Esri
const satelliteBaseMap = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles &copy; Esri &mdash; Source: Esri & GIS Community", // Map credit
    maxZoom: 23, // Maximum zoom level
  }
);

// Group base layers for toggling
const baseMaps = {
  OpenStreetMap: OSM,
  "Satellite (Esri)": satelliteBaseMap,
};

// Fetch the GeoTIFF raster file (DEM data)
fetch("Raster Data/Lagos-Dem.tif")
  .then((response) => response.arrayBuffer()) // Convert response to ArrayBuffer
  .then((arrayBuffer) => {
    parseGeoraster(arrayBuffer).then((georaster) => {
      // Create a GeoRasterLayer for the parsed raster data
      const geotiffLayer = new GeoRasterLayer({
        georaster: georaster, // Parsed raster data
        opacity: 0.6, // Layer transparency
        pixelValuesToColorFn: function (value) {
          // Function to assign colors based on pixel value
          if (value === 0) return "";
          if (value > 0 && value <= 1) return "#bd0026";
          if (value > 1 && value <= 2) return "#f03b20";
          if (value > 2 && value <= 5) return "#fd8d3c";
          if (value > 5 && value < 10) return "#fecc5c";
          if (value > 10 && value < 15) return "#ffffb2";
          if (value > 15 && value < 80) return "#c7e9c0";
        },
        resolution: 256, // Desired resolution
      });

      geotiffLayer.addTo(map); // Add raster layer to the map

      // Create an overlay map object for the control layer
      const overlayMaps = {
        "DEM Raster": geotiffLayer,
      };

      // Add base and overlay layers to the map control for toggling
      L.control.layers(baseMaps, overlayMaps).addTo(map);

      // Adjust the map view to fit the raster layer's bounds
      map.fitBounds(geotiffLayer.getBounds());

      // Create a legend control and position it bottom-right
      const legend = L.control({ position: "bottomright" });
      legend.onAdd = function () {
        const div = L.DomUtil.create("div", "info legend"); // Create a div for the legend
        const categories = [
          { name: "Unaffected Area (15m+)", color: "#c7e9c0" },
          { name: "Very Low Risk (10–15m)", color: "#ffffb2" },
          { name: "Low Risk (5–10m)", color: "#fecc5c" },
          { name: "Medium Risk (2–5m)", color: "#fd8d3c" },
          { name: "High Risk (1–2m)", color: "#f03b20" },
          { name: "Very High Risk (0–1m)", color: "#bd0026" },
          { name: "Ocean", color: "#ADD8E6" },
        ];
        div.innerHTML += "<h4>Sea Level Rise Categories</h4>"; // Legend title

        // Loop through categories and create color labels
        categories.forEach((cat) => {
          div.innerHTML += `
      <i style="background:${cat.color}; width:18px; height:18px; float:left; margin-right:8px; opacity:0.8"></i>
      <span style="line-height:18px;">${cat.name}</span><br/>
    `;
        });
        return div; // Return the completed legend
      };
      legend.addTo(map); // Add legend to map

      // Add click event to show pixel value and category on map click
      map.on("click", function (e) {
        const { lat, lng } = e.latlng; // Get latitude and longitude of click
        const x = Math.floor(
          (lng - georaster.xmin) / georaster.pixelWidth
        ); // Calculate X coordinate in raster
        const y = Math.floor(
          (georaster.ymax - lat) / georaster.pixelHeight
        ); // Calculate Y coordinate in raster

        // Check if clicked point is within raster bounds
        if (
          y >= 0 &&
          y < georaster.height &&
          x >= 0 &&
          x < georaster.width
        ) {
          const value = georaster.values[0][y][x]; // Get elevation value
          let categoryName = "Out of Range"; // Default category

          // Determine risk category based on value
          if (value === 0) categoryName = "Ocean";
          else if (value > 0 && value <= 1)
            categoryName = "Very High Risk (0–1m)";
          else if (value > 1 && value <= 2)
            categoryName = "High Risk (1–2m)";
          else if (value > 2 && value <= 5)
            categoryName = "Medium Risk (2–5m)";
          else if (value > 5 && value < 10)
            categoryName = "Low Risk (5–10m)";
          else if (value > 10 && value < 15)
            categoryName = "Very Low Risk (10–15m)";
          else if (value > 15 && value < 80)
            categoryName = "Unaffected Area (15m+)";

          // Create and show a popup at the clicked location
          L.popup()
            .setLatLng(e.latlng)
            .setContent(
              `<b>Elevation:</b> ${value.toFixed(
                2
              )} m<br/><b>Category:</b> ${categoryName}`
            )
            .openOn(map);
        }
      });
    });
  });

// Initialize the OpenStreetMap search provider
const provider = new GeoSearch.OpenStreetMapProvider();

// Create the search control UI and configure options
const searchControl = new GeoSearch.GeoSearchControl({
  provider: provider,
  style: "bar", // Style of the search box
  showMarker: true, // Show marker for search result
  showPopup: true, // Show popup for search result
  autoClose: true, // Auto-close suggestions after selection
  retainZoomLevel: false, // Allow automatic zoom on search
  searchLabel: "Enter location or coordinates...", // Placeholder text
});

map.addControl(searchControl); // Add search control to the map

// Function to convert DMS (Degrees Minutes Seconds) to Decimal Degrees
function dmsToDecimal(dms) {
  const regex = /(\d{1,3})[°\s](\d{1,2}\.\d+)[\'"]?([NSEW])/i; // Pattern for DMS format
  const match = dms.match(regex); // Match DMS input
  if (!match) return null; // Return null if invalid

  let degrees = parseFloat(match[1]); // Extract degrees
  let minutes = parseFloat(match[2]) / 60; // Convert minutes to decimal
  let direction = match[3].toUpperCase(); // Get direction N/S/E/W

  let decimal = degrees + minutes; // Combine degrees and minutes
  if (direction === "S" || direction === "W") decimal *= -1; // Negate for South or West

  return decimal; // Return decimal degree value
}

// Add event listener after DOM is fully loaded
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    const searchInput = document.querySelector(
      ".leaflet-control-geosearch input"
    ); // Select the search input field

    if (searchInput) {
      searchInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
          const input = event.target.value.trim(); // Get and clean user input

          const decimalPattern =
            /^(-?\d+(\.\d+)?)\s*,?\s*(-?\d+(\.\d+)?)$/; // Regex for decimal coordinates
          let match = input.match(decimalPattern);

          if (match) {
            let lat = parseFloat(match[1]);
            let lng = parseFloat(match[3]);
            moveToLocation(lat, lng); // Move to the coordinates
            return;
          }

          const dmsPattern =
            /(\d{1,3}[°\s]\d{1,2}\.\d+[NSEW])\s+(\d{1,3}[°\s]\d{1,2}\.\d+[NSEW])/i; // Regex for DMS format
          let dmsMatch = input.match(dmsPattern);

          if (dmsMatch) {
            const lng = dmsToDecimal(dmsMatch[1]);
            const lat = dmsToDecimal(dmsMatch[2]);
            if (lat !== null && lng !== null) {
              moveToLocation(lat, lng); // Move if valid DMS
            } else {
              alert("Invalid coordinate format!"); // Alert for invalid input
            }
          }
        }
      });
    }
  }, 1000); // Delay to ensure input field exists
});

// Function to move the map to the given coordinates and show marker
function moveToLocation(lat, lng) {
  // Swap coordinates if mistakenly reversed
  if (lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
    [lat, lng] = [lng, lat];
  }

  // Validate lat and lng are within world bounds
  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    satelliteBaseMap.addTo(map); // Add satellite view for clarity

    if (window._searchMarker) {
      map.removeLayer(window._searchMarker); // Remove old marker
    }

    // Create a marker at the specified coordinates
    window._searchMarker = L.marker([lat, lng], {
      title: `Exact Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, // Marker tooltip
    }).addTo(map);

    // Attach a popup showing precise coordinates
    window._searchMarker
      .bindPopup(
        `<b>Exact Location</b><br>Latitude: ${lat.toFixed(
          6
        )}<br>Longitude: ${lng.toFixed(6)}`
      )
      .openPopup(); // Open the popup

    map.setView([lat, lng], 23); // Zoom in for close view
  } else {
    alert(
      "Invalid coordinate range! Latitude must be between -90 and 90, Longitude between -180 and 180."
    ); // Alert for invalid coordinates
  }
}
