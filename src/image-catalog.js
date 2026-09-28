const categoryImages = Object.freeze({
  2: ['Eletrodomésticos', 'eletrodomesticos'],
  205: ['Beleza', 'beleza'],
  207: ['Conzinha', 'cozinha'],
  212: ['Colchões', 'colchoes'],
  213: ['Computadores', 'computadores'],
  214: ['Eletroportáteis', 'eletroportateis'],
  215: ['Fogões e Fornos', 'fogoes-fornos'],
  216: ['Geladeiras e Refrigeradores', 'geladeiras-refrigeradores'],
  217: ['Guarda-roupas', 'guarda-roupas'],
  218: ['MÓVEIS', 'moveis'],
  219: ['Periféricos', 'perifericos'],
  220: ['Quarto', 'quarto'],
  221: ['Racks e Painéis para TV', 'racks-paineis-tv'],
  222: ['Sala de Estar', 'sala-estar'],
  223: ['Secadores de Cabelo', 'secadores-cabelo'],
  224: ['Televisores', 'televisores'],
  225: ['Ventiladores', 'ventiladores'],
  226: ['Áudio', 'audio'],
});

const imageUrl = slug => `/images/categorias/${slug}/default.png`;

export const imageCatalog = Object.entries(categoryImages).map(([categoryId, [name, slug]]) => ({
  categoria_id: categoryId,
  categoria_nome: name,
  slug,
  imagem_url: imageUrl(slug),
}));

export function decorateWithImage(resourceName, row) {
  if (resourceName === 'produtos_plataformas') {
    const category = categoryImages[String(row.categoria_id)];
    return category ? { ...row, imagem_url: imageUrl(category[1]) } : row;
  }
  if (resourceName === 'categorias') {
    const category = categoryImages[String(row.id)];
    return category ? { ...row, imagem_url: imageUrl(category[1]) } : row;
  }
  return row;
}
