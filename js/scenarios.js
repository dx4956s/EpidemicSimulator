'use strict';

// waningImmunity : recovered lose immunity after ~15 s and become susceptible again
// asymptomaticRate: fraction of infected that look healthy but still spread disease
const SCENARIOS = [
  {
    id: 'sir', code: 'SIR', name: 'Classic SIR', subtitle: 'Textbook model',
    accentColor: '#4CAF50',
    description: 'The foundational Susceptible-Infected-Recovered model. Balanced parameters demonstrating classic epidemic bell curves.',
    params: { population:150, virus:3, infectionRate:50, deathRate:20, peoplePrecaution:3, recoveryRate:40, vaccinationRate:0,  quarantineThreshold:70 }
  },
  {
    id: 'covid19', code: 'COV', name: 'COVID-19', subtitle: 'Coronavirus 2019',
    accentColor: '#FF9800',
    waningImmunity: true, asymptomaticRate: 0.35,
    description: 'High transmissibility with 35% asymptomatic carriers (yellow). Immunity wanes — watch secondary waves emerge. Vaccination and early quarantine flatten the curve.',
    params: { population:200, virus:5, infectionRate:72, deathRate:7,  peoplePrecaution:5, recoveryRate:55, vaccinationRate:25, quarantineThreshold:30 }
  },
  {
    id: 'ebola', code: 'EBO', name: 'Ebola', subtitle: 'Hemorrhagic fever',
    accentColor: '#F44336',
    description: 'Extremely lethal (75% mortality) but low transmissibility. Rapid quarantine triggers at just 10% — the only realistic countermeasure.',
    params: { population:120, virus:2, infectionRate:30, deathRate:75, peoplePrecaution:8, recoveryRate:22, vaccinationRate:0,  quarantineThreshold:10 }
  },
  {
    id: 'influenza', code: 'FLU', name: 'Influenza', subtitle: 'Seasonal flu',
    accentColor: '#03A9F4',
    waningImmunity: true,
    description: 'Fast spread, quick recovery, low lethality. Immunity wanes seasonally — reinfection is common. 30% vaccination provides partial herd protection.',
    params: { population:200, virus:5, infectionRate:82, deathRate:4,  peoplePrecaution:2, recoveryRate:72, vaccinationRate:30, quarantineThreshold:80 }
  },
  {
    id: 'plague', code: 'BLK', name: 'Black Death', subtitle: 'Bubonic plague',
    accentColor: '#9C27B0',
    description: '14th-century pandemic. No treatment, no prevention. Quarantine only triggers at 95% — simulating medieval ignorance of contagion vectors.',
    params: { population:150, virus:3, infectionRate:58, deathRate:68, peoplePrecaution:1, recoveryRate:15, vaccinationRate:0,  quarantineThreshold:95 }
  },
  {
    id: 'zombie', code: 'ZMB', name: 'Zombie Virus', subtitle: 'Undead contagion',
    accentColor: '#8BC34A',
    zombieMode: true,
    description: 'No immunity, no cure. The dead reanimate and rejoin the infected. There is no quarantine threshold that matters — complete conversion is inevitable.',
    params: { population:180, virus:2, infectionRate:92, deathRate:0,  peoplePrecaution:0, recoveryRate:0,  vaccinationRate:0,  quarantineThreshold:100 }
  },
  {
    id: 'sars', code: 'SAR', name: 'SARS-CoV-1', subtitle: '2003 outbreak',
    accentColor: '#FF5722',
    description: 'Moderate spread but 10% case fatality rate. Aggressive contact tracing and quarantine at 20% threshold successfully contained the real-world outbreak.',
    params: { population:150, virus:3, infectionRate:45, deathRate:10, peoplePrecaution:7, recoveryRate:35, vaccinationRate:0,  quarantineThreshold:20 }
  },
  {
    id: 'measles', code: 'MEA', name: 'Measles', subtitle: 'Highly contagious',
    accentColor: '#E91E63',
    description: 'One of the most contagious diseases ever recorded (R₀ 12–18). 85% vaccination creates herd immunity — watch unvaccinated clusters ignite then extinguish.',
    params: { population:200, virus:1, infectionRate:96, deathRate:2,  peoplePrecaution:0, recoveryRate:60, vaccinationRate:85, quarantineThreshold:90 }
  },
  {
    id: 'spanishflu', code: 'SF1', name: 'Spanish Flu', subtitle: '1918 pandemic',
    accentColor: '#795548',
    description: 'The deadliest pandemic in modern history. High transmissibility combined with 25% mortality — no vaccine, minimal precautions, overwhelmed all containment.',
    params: { population:180, virus:4, infectionRate:70, deathRate:25, peoplePrecaution:2, recoveryRate:45, vaccinationRate:0,  quarantineThreshold:60 }
  },
  {
    id: 'smallpox', code: 'SPX', name: 'Smallpox', subtitle: 'Eradicated 1980',
    accentColor: '#607D8B',
    description: 'Moderate spread with 30% mortality. Highly effective vaccination (60%) demonstrates how ring vaccination eradicated this disease entirely by 1980.',
    params: { population:150, virus:2, infectionRate:55, deathRate:30, peoplePrecaution:3, recoveryRate:25, vaccinationRate:60, quarantineThreshold:40 }
  },
  {
    id: 'mers', code: 'MER', name: 'MERS-CoV', subtitle: 'Camel coronavirus',
    accentColor: '#FF6F00',
    description: '34% case fatality rate — the deadliest known coronavirus. Extremely low human-to-human transmissibility has so far prevented a global pandemic.',
    params: { population:120, virus:2, infectionRate:18, deathRate:34, peoplePrecaution:9, recoveryRate:30, vaccinationRate:0,  quarantineThreshold:8  }
  },
  {
    id: 'rabies', code: 'RAB', name: 'Rabies', subtitle: '99% fatal, slow spread',
    accentColor: '#D32F2F',
    description: 'Near 100% fatality once symptomatic. Extremely low direct spread. A study in how a disease can be both maximally lethal and minimally contagious.',
    params: { population:150, virus:2, infectionRate:12, deathRate:99, peoplePrecaution:5, recoveryRate:5,  vaccinationRate:0,  quarantineThreshold:50 }
  }
];

let activeScenario = SCENARIOS[0];

function selectScenario(id) {
  activeScenario = SCENARIOS.find(s => s.id === id) || SCENARIOS[0];

  document.querySelectorAll('.scenario-card').forEach(card =>
    card.classList.toggle('active', card.dataset.id === id)
  );

  const p = activeScenario.params;
  const map = [
    ['population',          'popu',  'population'],
    ['infected',            'infd',  'virus'],
    ['infectionRate',       'infr',  'infectionRate'],
    ['deathRate',           'der',   'deathRate'],
    ['pPrecaution',         'pre',   'peoplePrecaution'],
    ['recoveryRate',        'recov', 'recoveryRate'],
    ['vaccinationRate',     'vacc',  'vaccinationRate'],
    ['quarantineThreshold', 'quar',  'quarantineThreshold'],
  ];
  map.forEach(([sliderId, displayId, key]) => {
    const slider = document.getElementById(sliderId);
    const disp   = document.getElementById(displayId);
    if (slider && key in p) {
      slider.value = p[key];
      if (disp) disp.textContent = p[key];
      input[key] = p[key];
    }
  });

  input.zombieMode       = !!activeScenario.zombieMode;
  input.waningImmunity   = !!activeScenario.waningImmunity;
  input.asymptomaticRate = activeScenario.asymptomaticRate || 0;

  const descEl = document.getElementById('scenarioDesc');
  if (descEl) descEl.textContent = activeScenario.description;
}

function getCurrentScenario() { return activeScenario; }
