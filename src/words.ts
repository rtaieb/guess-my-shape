export const words = [
  "Banane", "Chien", "Chat", "Maison", "Voiture", "Arbre", "Soleil", "Lune", "Etoile", "Livre",
  "Pomme", "Ordinateur", "Telephone", "Fleur", "Oiseau", "Poisson", "Montagne", "Bateau", "Avion", "Train",
  "Velo", "Chaussure", "Chapeau", "Lunettes", "Montre", "Crayon", "Stylo", "Gomme", "Ciseaux", "Papier",
  "Couteau", "Fourchette", "Cuillere", "Assiette", "Verre", "Tasse", "Bouteille", "Lit", "Table", "Chaise",
  "Canapé", "Television", "Porte", "Fenetre", "Clé", "Sac", "Valise", "Parapluie", "Manteau", "Pantalon",
  "Chemise", "Robe", "Jupe", "Chaussette", "Gant", "Echarpe", "Bonnet", "Casquette", "Bague", "Collier",
  "Bracelet", "Boucle d'oreille", "Brosse", "Peigne", "Miroir", "Savon", "Shampoing", "Dentifrice", "Brosse a dents", "Serviette",
  "Nuage", "Pluie", "Neige", "Vent", "Eclair", "Tonnerre", "Arc-en-ciel", "Glace", "Feu", "Eau",
  "Terre", "Sable", "Roche", "Herbe", "Feuille", "Racine", "Branche", "Tronc", "Foret", "Desert"
];

export function getRandomWord(): string {
  return words[Math.floor(Math.random() * words.length)];
}
