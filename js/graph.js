'use strict';

const graphData = {
  healthy:   [],
  infected:  [],
  dead:      [],
  recovered: []
};

function renderGraph() {
  const makeX = arr => Array.from({ length: arr.length + 1 }, (_, i) => i);

  const traces = [
    {
      y: [input.population, ...graphData.healthy],
      x: makeX(graphData.healthy),
      name: 'Susceptible',
      mode: 'lines',
      line: { color: '#4CAF50', width: 2 }
    },
    {
      y: [0, ...graphData.infected],
      x: makeX(graphData.infected),
      name: 'Infected',
      mode: 'lines',
      line: { color: '#e84545', width: 2 }
    },
    {
      y: [0, ...graphData.recovered],
      x: makeX(graphData.recovered),
      name: 'Recovered',
      mode: 'lines',
      line: { color: '#00ddaa', width: 2 }
    },
    {
      y: [0, ...graphData.dead],
      x: makeX(graphData.dead),
      name: 'Deaths',
      mode: 'lines',
      line: { color: '#777777', width: 2 }
    }
  ];

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  '#000',
    font:   { color: '#5a8a5c', size: 10, family: 'monospace' },
    legend: { x: 0, y: 1, bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
    margin: { t: 8, b: 36, l: 44, r: 10 },
    xaxis: {
      title: 'Time (intervals)', gridcolor: '#1a2568',
      color: '#4CAF50', tickfont: { size: 9 }
    },
    yaxis: {
      title: 'Population', gridcolor: '#1a2568',
      color: '#4CAF50', tickfont: { size: 9 }
    }
  };

  Plotly.react('myChart', traces, layout, { displayModeBar: false });
}

function clearGraph() {
  graphData.healthy   = [];
  graphData.infected  = [];
  graphData.dead      = [];
  graphData.recovered = [];
  Plotly.purge('myChart');
}
