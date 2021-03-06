/******************************* APP.JS ***********************************************/
function dashboard() {
    d3.queue()
        .defer(d3.json, "//unpkg.com/world-atlas@1.1.4/world/50m.json")
        .defer(d3.csv, "https://s3.amazonaws.com/d3map-csv/all_data.csv", row => {
            return {
                continent: row.Continent,
                country: row.Country,
                countryCode: row["Country Code"],
                emissions: +row["Emissions"],
                emissionsPerCapita: +row["Emissions Per Capita"],
                region: row.Region,
                year: +row.Year
            }
        })
        .await((error, mapData, data) => {
            if (error) throw error;

            var extremeYears = d3.extent(data, d => d.year);
            var currentYear = extremeYears[0];
            var currentDataType = d3.select('input[name="data-type"]:checked')
                .attr("value");
            var geoData = topojson.feature(mapData, mapData.objects.countries).features;

            var width = +d3.select(".chart-container")
                .node().offsetWidth;
            var height = 300;

            createMap(width, width * 4 / 5);
            createPie(width, height);
            createBar(width, height);
            drawMap(geoData, data, currentYear, currentDataType);
            drawPie(data, currentYear);
            drawBar(data, currentDataType, "");

            d3.select("#year")
                .property("min", currentYear)
                .property("max", extremeYears[1])
                .property("value", currentYear)
                .on("input", () => {
                    currentYear = +d3.event.target.value;
                    drawMap(geoData, data, currentYear, currentDataType);
                    drawPie(data, currentYear);
                    highlightBars(currentYear);
                });

            d3.selectAll('input[name="data-type"]')
                .on("change", () => {
                    var active = d3.select(".active").data()[0];
                    var country = active ? active.properties.country : "";
                    currentDataType = d3.event.target.value;
                    drawMap(geoData, data, currentYear, currentDataType);
                    drawBar(data, currentDataType, country);
                });

            d3.selectAll("svg")
                .on("mousemove touchmove", updateTooltip);

            function updateTooltip() {
                var tooltip = d3.select(".tooltip");
                var tgt = d3.select(d3.event.target);
                var isCountry = tgt.classed("country");
                var isBar = tgt.classed("bar");
                var isArc = tgt.classed("arc");
                var dataType = d3.select("input:checked")
                    .property("value");
                var units = dataType === "emissions" ? "thousand metric tons" : "metric tons per capita";
                var data;
                var percentage = "";
                if (isCountry) data = tgt.data()[0].properties;
                if (isArc) {
                    data = tgt.data()[0].data;
                    percentage = `<p>Percentage of total: ${getPercentage(tgt.data()[0])}</p>`;
                }
                if (isBar) data = tgt.data()[0];
                tooltip
                    .style("opacity", +(isCountry || isArc || isBar))
                    .style("left", (d3.event.pageX - tooltip.node().offsetWidth / 2) + "px")
                    .style("top", (d3.event.pageY - tooltip.node().offsetHeight - 10) + "px");
                if (data) {
                    var dataValue = data[dataType] ?
                        data[dataType].toLocaleString() + " " + units :
                        "Data Not Available";
                    tooltip
                        .html(`
            <p>Country: ${data.country}</p>
            <p>${formatDataType(dataType)}: ${dataValue}</p>
            <p>Year: ${data.year || d3.select("#year").property("value")}</p>
            ${percentage}
          `)
                }
            }
        });

    function formatDataType(key) {
        return key[0].toUpperCase() + key.slice(1).replace(/[A-Z]/g, c => " " + c);
    }

    function getPercentage(d) {
        var angle = d.endAngle - d.startAngle;
        var fraction = 100 * angle / (Math.PI * 2);
        return fraction.toFixed(2) + "%";
    }


    /******************************* MAPA.JS ***********************************************/

    function createMap(width, height) {
        d3.select("#map")
            .attr("width", width)
            .attr("height", height)
            .append("text")
            .attr("x", width / 2)
            .attr("y", "1em")
            .attr("font-size", "1.5em")
            .style("text-anchor", "middle")
            .classed("map-title", true);
    }

    function drawMap(geoData, climateData, year, dataType) {
        var map = d3.select("#map");

        var projection = d3.geoMercator()
            .scale(110)
            .translate([+map.attr("width") / 2, +map.attr("height") / 1.4]);

        var path = d3.geoPath()
            .projection(projection);

        d3.select("#year-val").text(year);

        geoData.forEach(d => {
            var countries = climateData.filter(row => row.countryCode === d.id);
            var name = '';
            if (countries.length > 0) name = countries[0].country;
            d.properties = countries.find(c => c.year === year) || { country: name };
        });

        var colors = ["#000080", "#0000FF", "#008080", "#00FFFF"];

        var domains = {
            emissions: [0, 2.5e5, 1e6, 5e6],
            emissionsPerCapita: [0, 0.5, 2, 10]
        };

        var mapColorScale = d3.scaleLinear()
            .domain(domains[dataType])
            .range(colors);

        var update = map.selectAll(".country")
            .data(geoData);

        update
            .enter()
            .append("path")
            .classed("country", true)
            .attr("d", path)
            .on("click", function() {
                var currentDataType = d3.select("input:checked")
                    .property("value");
                var country = d3.select(this);
                var isActive = country.classed("active");
                var countryName = isActive ? "" : country.data()[0].properties.country;
                drawBar(climateData, currentDataType, countryName);
                highlightBars(+d3.select("#year").property("value"));
                d3.selectAll(".country").classed("active", false);
                country.classed("active", !isActive);
            })
            .merge(update)
            .transition()
            .duration(750)
            .attr("fill", d => {
                var val = d.properties[dataType];
                return val ? mapColorScale(val) : "#ccc";
            });

        d3.select(".map-title")
            .text("Dioxido de Carbono emisiones" + /*graphTitle(dataType) +*/ ", " + year);
    }

    function graphTitle(str) {
        return str.replace(/[A-Z]/g, c => " " + c.toLowerCase());
    }

    /******************************* PIE.JS ***********************************************/

    function createPie(width, height) {
        var pie = d3.select("#pie")
            .attr("width", width)
            .attr("height", height)

        pie.append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2 + 10})`)
            .classed("chart", true);

        pie.append("text")
            .attr("x", width / 2)
            .attr("y", "1em")
            .attr("font-size", "1.5em")
            .style("text-anchor", "middle")
            .classed("pie-title", true);
    }

    function drawPie(data, currentYear) {
        var pie = d3.select("#pie");

        var arcs = d3.pie()
            .sort((a, b) => {
                if (a.continent < b.continent) return -1;
                if (a.continent > b.continent) return 1;
                return a.emissions - b.emissions;
            })
            .value(d => d.emissions);

        var path = d3.arc()
            .outerRadius(+pie.attr("height") / 2 - 50)
            .innerRadius(0);

        var yearData = data.filter(d => d.year === currentYear);
        var continents = [];
        for (let i = 0; i < yearData.length; i++) {
            var continent = yearData[i].continent;
            if (!continents.includes(continent)) {
                continents.push(continent);
            }
        }

        var colorScale = d3.scaleOrdinal()
            .domain(continents)
            .range(["#FE0505", "#FE1C05", "#FE5C05", "#FE8505", "#FE9C05"]);

        var update = pie
            .select(".chart")
            .selectAll(".arc")
            .data(arcs(yearData));

        update
            .exit()
            .remove();

        update
            .enter()
            .append("path")
            .classed("arc", true)
            .attr("stroke", "#dff1ff")
            .attr("stroke-width", "0.25px")
            .merge(update)
            .attr("fill", d => colorScale(d.data.continent))
            .attr("d", path);

        pie.select(".pie-title")
            .text(`Total de Emisiones por Continente y Regi??n, ${currentYear}`);
    }

    /******************************* BARRAS.JS ***********************************************/

    function createBar(width, height) {
        var bar = d3.select("#bar")
            .attr("width", width)
            .attr("height", height);

        bar.append("g")
            .classed("x-axis", true);

        bar.append("g")
            .classed("y-axis", true);

        bar.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", "1em")
            .classed("y-axis-label", true);

        bar.append("text")
            .attr("x", width / 2)
            .attr("y", "1em")
            .attr("font-size", "1.5em")
            .style("text-anchor", "middle")
            .classed("bar-title", true);
    }

    function highlightBars(year) {
        d3.select("#bar")
            .selectAll("rect")
            .attr("fill", d => d.year === year ? "#008000" : "#808000");
    }

    function drawBar(data, dataType, country) {
        var bar = d3.select("#bar");
        var padding = {
            top: 30,
            right: 30,
            bottom: 30,
            left: 110
        };
        var barPadding = 1;
        var width = +bar.attr("width");
        var height = +bar.attr("height");
        var countryData = data.filter(d => d.country === country)
            .sort((a, b) => a.year - b.year);

        var xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.year))
            .range([padding.left, width - padding.right]);

        var yScale = d3.scaleLinear()
            .domain([0, d3.max(countryData, d => d[dataType])])
            .range([height - padding.bottom, padding.top]);

        var barWidth = xScale(xScale.domain()[0] + 1) - xScale.range()[0];

        var xAxis = d3.axisBottom(xScale)
            .tickFormat(d3.format(".0f"));

        d3.select(".x-axis")
            .attr("transform", `translate(0, ${height - padding.bottom})`)
            .call(xAxis);

        var yAxis = d3.axisLeft(yScale);

        d3.select(".y-axis")
            .attr("transform", `translate(${padding.left - barWidth / 2},0)`)
            .transition()
            .duration(1000)
            .call(yAxis);

        var axisLabel = dataType === "emissions" ?
            "Emisiones de CO2, en miles de toneladas" :
            "Emisiones de CO2, toneladas per c??pita";

        var barTitle = country ?
            "Emisiones de CO2, " + country :
            "Haz clic en un pa??s para ver la tendencia anual";

        d3.select(".y-axis-label")
            .text(axisLabel);

        d3.select(".bar-title")
            .text(barTitle);

        var t = d3.transition()
            .duration(1000)
            .ease(d3.easeBounceOut);

        var update = bar
            .selectAll(".bar")
            .data(countryData);

        update
            .exit()
            .transition(t)
            .delay((d, i, nodes) => (nodes.length - i - 1) * 100)
            .attr("y", height - padding.bottom)
            .attr("height", 0)
            .remove();

        update
            .enter()
            .append("rect")
            .classed("bar", true)
            .attr("y", height - padding.bottom)
            .attr("height", 0)
            .merge(update)
            .attr("x", d => (xScale(d.year) + xScale(d.year - 1)) / 2)
            .attr("width", barWidth - barPadding)
            .transition(t)
            .delay((d, i) => i * 100)
            .attr("y", d => yScale(d[dataType]))
            .attr("height", d => height - padding.bottom - yScale(d[dataType]));
    }
}