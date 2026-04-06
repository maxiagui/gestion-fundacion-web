export const normalizeSearch = (str: string) => {
  if (!str) return '';
  const map: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
    'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u',
    'À': 'a', 'È': 'e', 'Ì': 'i', 'Ò': 'o', 'Ù': 'u',
    'Ä': 'a', 'Ë': 'e', 'Ï': 'i', 'Ö': 'o', 'Ü': 'u',
    'Â': 'a', 'Ê': 'e', 'Î': 'i', 'Ô': 'o', 'Û': 'u'
  };
  return str.toLowerCase().replace(/[áéíóúàèìòùäëïöüâêîôûÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛ]/g, match => map[match] || match);
};

export const toCapitalCase = (str: string | undefined | null) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
export const LOCALIDADES = [
  "Aguas Verdes",
  "Costa Azul",
  "Costa Chica",
  "Costa del Este",
  "Costa Esmeralda",
  "Gral Lavalle",
  "La Lucila del Mar",
  "Las Toninas",
  "Mar de Ajó",
  "Mar del Tuyú",
  "Nueva Atlantis",
  "Paraje Pavón",
  "Pinamar",
  "San Bernardo",
  "San Clemente del Tuyú",
  "Santa Teresita"
];
