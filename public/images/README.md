# Repositório de imagens de produtos

As imagens ficam públicas pela rota `/images`. Não coloque arquivos confidenciais nesta pasta.

## Imagens padrão por categoria

Cada categoria ativa possui uma imagem genérica em:

```text
categorias/<slug>/default.png
```

Exemplo de URL:

```text
http://127.0.0.1:3000/images/categorias/televisores/default.png
```

Essas imagens foram geradas como placeholders de catálogo, sem representar marca ou modelo específico. A API inclui `imagem_url` nas respostas de `categorias` e `produtos_plataformas` quando a categoria possui uma imagem cadastrada em `src/image-catalog.js`.

## Fotos reais por produto

Quando as fotos reais forem disponibilizadas, use o código único de `produtos_plataformas.codigo` como pasta:

```text
produtos/<codigo>/principal.webp
produtos/<codigo>/01.webp
produtos/<codigo>/02.webp
```

Regras recomendadas:

- use WebP ou AVIF para as fotos finais;
- mantenha `principal.webp` como capa;
- use nomes numéricos com dois dígitos para a galeria;
- não use descrição, marca ou espaços no nome da pasta;
- mantenha proporção quadrada e pelo menos 1200 × 1200 pixels;
- remova metadados desnecessários antes da publicação.

Exemplo para o produto de código `SKU-001`:

```text
public/images/produtos/SKU-001/principal.webp
http://127.0.0.1:3000/images/produtos/SKU-001/principal.webp
```

Adicionar um arquivo à pasta não altera o banco automaticamente. Quando as fotos individuais começarem a ser alimentadas, o próximo passo recomendado é criar uma tabela `produto_imagens` para registrar URL, ordem e imagem principal.
