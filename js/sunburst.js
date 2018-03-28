// Inspiration from
// https://bl.ocks.org/maybelinot/5552606564ef37b5de7e47ed2b7dc099
// https://stackoverflow.com/questions/49252652/rotate-labels-in-d3-sunburst-v4
// http://bl.ocks.org/mbostock/910126
// https://www.jasondavies.com/coffee-wheel/
// https://gist.github.com/denjn5/00a57e89c67906897b6eede56219170e
// https://bl.ocks.org/mbostock/1846692

var width = 960,
  height = 700,
  radius = (Math.min(width, height) / 2) - 10;

var formatNumber = d3.format(",d");

var x = d3.scaleLinear()
  .range([0, 2 * Math.PI]);

var y = d3.scaleLinear()
  .range([0, radius]);

var color = d3.scaleOrdinal(d3.schemeCategory20);

var partition = d3.partition();

function startAngle(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x0))); }
function endAngle(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x1))); }
function innerRadius(d) { return Math.max(0, y(d.y0)); }
function outerRadius(d) { return Math.max(0, y(d.y1)); }

var arc = d3.arc()
  .startAngle( function(d) { return startAngle(d);  })
  .endAngle(   function(d) { return endAngle(d);    })
  .innerRadius(function(d) { return innerRadius(d); })
  .outerRadius(function(d) { return outerRadius(d); })

var texttransform = function(d) {
  var translation = y(d.y0);
  var rotation = computeTextRotation(d);

  if (rotation > 90 && rotation < 270) {
    rotation = rotation + 180;
    translation = -translation;
  }
  return (
    "rotate(" + rotation + ")" +
    "translate(" + translation + ",0)"
  );
}

function computeTextRotation(d) {
  if (d.depth === 0) {
    return 0;
  }
  var angle = (x((d.x0 + d.x1)/2) - Math.PI / 2) / Math.PI * 180;
  return (angle >  90 || angle < 270) ?  angle : 180 + angle ;
}

var textanchor = function(d) {
  if (d.depth === 0) {
    return "middle";
  }
  var rotation = computeTextRotation(d);
  return (rotation > 90 && rotation < 270) ? "end" : "start";
}

var textdx = function(d) {
  if (d.depth === 0) {
    return 0;
  }
  var rotation = computeTextRotation(d);
  return (rotation > 90 && rotation < 270) ? -6 : 6;
}

var svg = d3.select("body").append("svg")
  .attr("width", width)
  .attr("height", height)
  .append("g")
  .attr("transform", "translate(" + width / 2 + "," + (height / 2) + ")");

function calcFontSize(d) {
  const xFactor = 12, yFactor = 7.5 ; // stub

  if (d.depth === 0) {
    return "30px";
  }

  // use inner arc len as text height delimiter
  var innerArc = (endAngle(d) - startAngle(d)) * 2 * Math.PI * innerRadius(d);

  var len = (d.y1-d.y0) * radius;
  return Math.min(innerArc / yFactor, len / d.data.textlen * xFactor) + "px";
}

function click(d = { x0: 0, x1: 1, y0: 0, y1: 1 }) {
  trans = svg.transition().duration(750);

  trans.selectAll("path")
    .attrTween("d", function(n) { return function() { return arc(n); }; })
    .tween("scale", function() {
      var xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
      yd = d3.interpolate(y.domain(), [d.y0, 1]),
      yr = d3.interpolate(y.range(), [d.y0 ? 20 : 0, radius]);

      return function(t) {
        x.domain(xd(t));
        y.domain(yd(t)).range(yr(t));
      };
    });

    trans.selectAll("text")
      .attrTween("transform",   function(n) { return function() { return texttransform(n); }; })
      .attrTween("text-anchor", function(n) { return function() { return textanchor(n); }; })
      .attrTween("dx",          function(n) { return function() { return textdx(n); }; })
      .styleTween("font-size",  function(n) { return function() { return calcFontSize(n); }; });

    trans.selectAll("text")
      .delay(400)
      .attrTween("opacity",     function(n) { return function() {
        if (d === n || n.ancestors().includes(d)) {
          return 1;
        } else {
          return 0;
        }
      }; });
}

d3.text('data/feelings_EN.txt', function(error, raw){
  if (error) throw error;

  // replace two-space indentation with pipes
  raw = raw.replace(new RegExp('  ', 'g'), '|');

  //read pipe-delimited data
  var dsv = d3.dsvFormat('|');
  var flatData = dsv.parse(raw);
  var rData = tree(flatData);

  rData = d3.hierarchy(rData);

  var nodes = partition(rData
      .sum(function(d) { return 1; }) // each leaf gets a size of 1
      .sort(function(a, b) { d3.ascending(a.name, b.name) }) // not working?
    )
    .descendants();

  g = svg.selectAll("path")
    .data(nodes)
    .enter().append("g");

  path = g.append("path")
    .attr("d", arc)
    .style("fill", function(d, i) {
      var c;
      if (d.depth === 0) {
        return "white";
      } else if (d.depth === 1) {
        c = color((d.children ? d : d.parent).data.name);
      } else if (d.depth > 1) {
        c = d3.color(d.parent.data.color).darker();
      }
      d.data.color = c;
      return c;
    })
    .on("click", click)
    .append("title")
    .text(function(d) { return d.data.name });

  text = g.append("text")
    .style("fill", function(d) {
      if (d.depth === 0) {
        return "#CCC";
      } else {
        return "#FFF";
      }})
    .attr("class", "svglabel")

    .attr("transform",   texttransform)
    .attr("text-anchor", textanchor)
    .attr("dx",  textdx)
    .attr("dy", ".35em") // vertical-align
    .text(function(d) { return d.data.name; })
    .style("font-size", function(d) {
        // hack. save text len as property to make accessible in transiton
        d.data.textlen = this.getComputedTextLength();
        return calcFontSize(d);
      });
  });

function tree(nodes) {
  var curr, parent, root;
  var lev = 1;

  nodes.forEach(function(d) {
    if (!root) {
      // handle root (first node)
      curr = {
        name:     d.d1,
        children: []
      };
      root   = curr;
      parent = curr;

    } else {

      if (d['d' + (lev+1)]) {
        // handle children
        lev = lev+1;
        parent = curr;

      } else if (d['d' + (lev-1)]) {
        // handle moving up the hierarchy
        lev = lev-1;
        parent = parent.parent;

      } else if (!d['d' + lev]) {
        // if it's neither child, nor moving up, nor a sibling, handle exception
        throw "unhandled tree level";
      }

      curr = {
        name:     d['d' + lev],
        children: []
      };
      curr.parent = parent;
      parent.children.push(curr);
    }
  });

  return root;
}