'use strict';

var input = {
  population:          150,
  virus:                 3,
  infectionRate:        50,
  deathRate:            20,
  peoplePrecaution:      3,
  recoveryRate:         40,
  vaccinationRate:       0,
  quarantineThreshold:  70,
  zombieMode:        false,
  waningImmunity:    false,
  asymptomaticRate:      0
};

window.onload = function () {
  // Build scenario cards
  const grid = document.getElementById('scenarioGrid');
  if (grid) {
    SCENARIOS.forEach(s => {
      const card = document.createElement('div');
      card.className = 'scenario-card' + (s.id === 'sir' ? ' active' : '');
      card.dataset.id = s.id;
      card.style.setProperty('--accent', s.accentColor);
      card.innerHTML =
        `<span class="sc-code">${s.code}</span>` +
        `<span class="sc-name">${s.name}</span>` +
        `<span class="sc-sub">${s.subtitle}</span>`;
      card.addEventListener('click', () => selectScenario(s.id));
      grid.appendChild(card);
    });
  }

  // Bind sliders
  const sliders = [
    { id: 'population',          display: 'popu',  key: 'population'          },
    { id: 'infected',            display: 'infd',  key: 'virus'               },
    { id: 'infectionRate',       display: 'infr',  key: 'infectionRate'       },
    { id: 'deathRate',           display: 'der',   key: 'deathRate'           },
    { id: 'pPrecaution',         display: 'pre',   key: 'peoplePrecaution'    },
    { id: 'recoveryRate',        display: 'recov', key: 'recoveryRate'        },
    { id: 'vaccinationRate',     display: 'vacc',  key: 'vaccinationRate'     },
    { id: 'quarantineThreshold', display: 'quar',  key: 'quarantineThreshold' }
  ];

  sliders.forEach(({ id, display, key }) => {
    const slider  = document.getElementById(id);
    const readout = document.getElementById(display);
    if (!slider || !readout) return;
    readout.textContent = slider.value;
    input[key] = parseInt(slider.value, 10);
    slider.oninput = function () {
      readout.textContent = this.value;
      input[key] = parseInt(this.value, 10);
    };
  });

  // Load first scenario then run
  selectScenario('sir');
  simulate();
};
