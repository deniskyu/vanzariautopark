// ============================================================================
//  src/data/carOptions.js
// ----------------------------------------------------------------------------
//  Toate listele de valori permise pentru un anunț, într-un singur loc.
//
//  Sunt folosite ÎN TREI locuri: la randarea formularului din admin (ca
//  opțiuni de select), la validarea pe server (o valoare din afara listei e
//  respinsă), și la randarea filtrelor de pe pagina de stoc.
//
//  Regula: o valoare care nu e aici NU poate ajunge în baza de date. Un select
//  manipulat din DevTools nu poate strecura gunoi.
//
//  ⚠️ Modelul mașinii a fost SCOS intenționat față de sistemul vechi — se
//  păstrează doar marca. Anul se completează automat (vezi currentYear).
// ============================================================================

// 168 de mărci reale + „Altă marcă" pentru ce nu e acoperit.
export const BRANDS = [
    'Abarth', 'Acura', 'Aigo', 'Aiways',
    'Aixam', 'Alfa Romeo', 'Allview', 'Alpina',
    'Alpine', 'AONEW', 'Aro', 'Aston Martin',
    'Audi', 'Austin', 'AVATR', 'Baic',
    'Baw', 'Beauford', 'Bentley', 'BMW',
    'Bronco Sport', 'Bugatti', 'Buick', 'Byd',
    'Cadillac', 'Cenntro', 'Chatenet', 'Chery',
    'Chevrolet', 'Chrysler', 'Comarth', 'Cupra',
    'Dacia', 'Daewoo', 'Daihatsu', 'DFSK',
    'DKW', 'Dodge', 'Dongwei', 'DR',
    'DS Automobiles', 'e.GO', 'Eagle', 'Elaris',
    'Excalibur', 'Ferrari', 'Fiat', 'Ford',
    'Forthing', 'Geely', 'Genesis', 'GMC',
    'Gonow', 'Grecav', 'Haval', 'Holden',
    'Honda', 'Hongqi', 'Hummer', 'Hyundai',
    'IM Motors', 'Ineos', 'Infiniti', 'Isuzu',
    'Iveco', 'JAC', 'Jaecoo', 'Jaguar',
    'Jeep', 'Jetour', 'Kaipan', 'KGM',
    'Kia', 'Koenigsegg', 'KTM X-Bow', 'Lada',
    'Lamborghini', 'Lancia', 'Land Rover', 'Leapmotor',
    'Lexus', 'Li Auto', 'Ligier', 'Lincoln',
    'LINKTOUR', 'Lomax', 'Lotus', 'LuAZ',
    'Lucid', 'Lynk&Co', 'Mahindra', 'Maruti',
    'Maserati', 'Maxus', 'Maybach', 'Mazda',
    'McLaren', 'Mercedes-Benz', 'Mercury', 'MG',
    'Microcar', 'Microlino', 'Mini', 'Mitsubishi',
    'Morgan', 'MPM Motors', 'Nio', 'Nissan',
    'NSU', 'Nysa', 'Oldsmobile', 'Omoda',
    'Onvo', 'Opel', 'Peugeot', 'Plymouth',
    'Polestar', 'Polonez', 'Pontiac', 'Porsche',
    'Proton', 'Prototip', 'RDB', 'Relive',
    'Renault', 'Rivian', 'Rolls-Royce', 'Rover',
    'Saab', 'Samsung', 'Saturn', 'Seat',
    'Seres', 'Simca', 'Skoda', 'Skywell',
    'Smart', 'Smart Balance', 'SsangYong', 'Stelato',
    'Studebaker', 'Subaru', 'Suda', 'Suzuki',
    'SWM', 'Syrena', 'Tarpan', 'Tata',
    'Tatra', 'Tavria', 'Tazzari', 'Tesla',
    'Today Sunshine', 'Toyota', 'Trabant', 'Triumph',
    'TVR', 'Vauxhall', 'Volkswagen', 'Volvo',
    'Voyah', 'Warszawa', 'Xev', 'Xiaomi',
    'Xpeng', 'Yugo', 'Zastawa', 'Zeekr',
    'Altă marcă',
];

// Capacitate cilindrică: select, nu text liber. „Fără (Electric)" + 0.6-7.4 L.
export const ENGINE_CAPACITIES = [
    'Fără (Electric)', '0.6 L', '0.7 L', '0.8 L', '0.9 L', '1.0 L',
    '1.1 L', '1.2 L', '1.3 L', '1.4 L', '1.5 L', '1.6 L',
    '1.7 L', '1.8 L', '1.9 L', '2.0 L', '2.1 L', '2.2 L',
    '2.3 L', '2.4 L', '2.5 L', '2.6 L', '2.7 L', '2.8 L',
    '2.9 L', '3.0 L', '3.1 L', '3.2 L', '3.3 L', '3.4 L',
    '3.5 L', '3.6 L', '3.7 L', '3.8 L', '3.9 L', '4.0 L',
    '4.1 L', '4.2 L', '4.3 L', '4.4 L', '4.5 L', '4.6 L',
    '4.7 L', '4.8 L', '4.9 L', '5.0 L', '5.1 L', '5.2 L',
    '5.3 L', '5.4 L', '5.5 L', '5.6 L', '5.7 L', '5.8 L',
    '5.9 L', '6.0 L', '6.1 L', '6.2 L', '6.3 L', '6.4 L',
    '6.5 L', '6.6 L', '6.7 L', '6.8 L', '6.9 L', '7.0 L',
    '7.1 L', '7.2 L', '7.3 L', '7.4 L',
];

// Combustibil. Aceleași valori ca în aplicația veche.
export const FUEL_TYPES = [
    'Benzină', 'Motorină', 'Electric', 'Hibrid Benzină', 'Hibrid Motorină',
    'Hidrogen', 'Benzină + GPL', 'Etanol', 'GPL', 'Altul',
];

export const BODY_TYPES = [
    'Berlină', 'Break', 'Hatchback', 'SUV', 'Coupe',
    'Cabrio', 'Monovolum', 'Pick-up', 'Off-road', 'Van', 'Roadster', 'Limuzină', 'Microcar', 
    'Minivan', 'Altul', 
];

export const TRANSMISSIONS = ['Manuală', 'Automată'];

export const DRIVETRAINS = ['Față', 'Spate', 'Integrală (4x4)'];

export const POLLUTION_STANDARDS = [
    'Non-Euro', 'Euro 1', 'Euro 2', 'Euro 3', 'Euro 4', 'Euro 5', 'Euro 6', 'Hibrid', 'Electric', 'Altul',
];

export const COLORS = [
    'Alb', 'Negru', 'Gri', 'Argintiu', 'Albastru', 'Roșu', 'Verde',
    'Galben', 'Maro', 'Portocaliu', 'Bej', 'Auriu', 'Alta culoare',
];

// Valori BRUTE, ca în aplicația veche — nu etichetele afișate.
export const REGISTRATION_STATUS = [
    { value: 'registered', label: 'Înmatriculat' },
    { value: 'unregistered', label: 'Neînmatriculat' },
];

export const STEERING = [
    { value: 'left', label: 'Stânga' },
    { value: 'right', label: 'Dreapta' },
];

const currentYear = new Date().getFullYear();
// Generează anii descrescător, de la anul curent până la 1990 (poți schimba 1989 dacă vrei mai vechi)
export const YEARS = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i);

// Limitele de caractere. Folosite ȘI la validarea din admin (contor + blocare),
// ȘI la validarea pe server.
export const LIMITS = {
    title:        80,     // mai lung decât în sistemul vechi (era 35)
    description:  4000,   // mult mai lung (era 1500)
    max_photos:   20,
    max_photo_bytes: 15 * 1024 * 1024,
};

// Helper: o valoare e permisă? Funcționează pe liste simple și pe {value,label}.
export const isAllowed = (value, list) => {
    if (!Array.isArray(list)) return false;
    return list.some((item) =>
        typeof item === 'string' ? item === value : item.value === value
    );
};

// Eticheta pentru o valoare brută (registered → Înmatriculat).
export const labelOf = (value, list) => {
    const found = (list || []).find((i) => typeof i === 'object' && i.value === value);
    return found ? found.label : value;
};

export default {
    BRANDS, ENGINE_CAPACITIES, FUEL_TYPES, BODY_TYPES, TRANSMISSIONS,
    DRIVETRAINS, POLLUTION_STANDARDS, COLORS, REGISTRATION_STATUS, STEERING,
    YEARS, currentYear, LIMITS, isAllowed, labelOf,
};
