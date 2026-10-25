"""Esporta le sfere fornite in assets/skills/; non modifica gli originali.

I 18 asset richiesti, incluse due varianti Windows. Pillow è già usato dagli
altri esportatori. WebP lossless conserva il canale alpha.
"""
from asset_paths import source_path, output_path
from PIL import Image

SKILLS = {
    'html': 'Bolla HTML5 fluttuante in pixel art-3.png',
    'css': 'Scudo CSS3 in bolla di vetro-6.png',
    'javascript': 'Bolla JavaScript in vetro pixel art-2.png',
    'vue': 'Bolla pixel art con logo Vue-5.png',
    'php': 'Bolla PHP cyberpunk in pixel art-10.png',
    'laravel': 'Bolla di vetro cyberpunk con logo Laravel-7.png',
    'aem': 'Bolla di vetro pixel art AEM-1.png',
    'wordpress': 'Bolla WordPress in vetro pixel art-3.png',
    'jira': 'Bolla pixel art con logo Jira-11.png',
    'linux': 'Tux in una bolla cyberpunk-1.png',
    'github': 'Bolla GitHub con Octocat pixel art-2.png',
    'typescript': 'Bolla TypeScript di vetro al neon-2.png',
    'react': 'Bolla React cibernetica in pixel art-1.png',
    'python': 'Bolla pixel art con logo Python-8.png',
    'claude': 'Bolla pixel-art con simbolo Claude-12.png',
    'shopify': 'Bolla di vetro pixel art Shopify-3.png',
    'windows': 'Bolla pixel art con logo Windows-4.png',
    'windows-blue': 'Bolla pixel con logo Windows azzurro-9.png',
}

if __name__ == '__main__':
    for name, source in SKILLS.items():
        with Image.open(source_path(source)) as image:
            image = image.convert('RGBA')
            # Uniform canvas and nearest-neighbour sampling preserve hard pixel edges.
            image.resize((256, 256), Image.Resampling.NEAREST).save(
                output_path(f'{name}.webp'), lossless=True, method=6)
    print(f'Esportate {len(SKILLS)} sfere trasparenti in dist/assets/skills')
