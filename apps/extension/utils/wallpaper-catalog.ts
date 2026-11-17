// 精选壁纸：风景照来自 Lorem Picsum（Unsplash 许可），画作来自克利夫兰艺术博物馆 Open Access（CC0）。
// 只存编号和署名，图片由对应服务按编号提供。
export interface CuratedWallpaper {
  id: string;
  thumb: string;
  full: string;
  author: string;
  title: string;
}

export const CURATED_CATEGORIES = ['nature', 'art'] as const;
export type CuratedCategory = (typeof CURATED_CATEGORIES)[number];

// [Picsum 图片编号, 摄影师]
const NATURE: [number, string][] = [
  [28, 'Jerry Adney'], [29, 'Go Wild'], [46, 'Jeffrey Kam'], [66, 'Nicholas Swanson'],
  [54, 'Nicholas Swanson'], [69, 'Alexander Shustov'], [81, 'Sander Weeteling'], [83, 'Julie Geiger'],
  [987, 'Sebastien Gabriel'], [991, 'Fritz Bielmeier'], [993, 'Eric Huang'], [1000, 'Lukas Budimaier'],
  [1015, 'Alexey Topolyanskiy'], [1016, 'Philippe Wuyts'], [1018, 'Andrew Ridley'], [1022, 'Vashishtha Jogi'],
  [1036, 'Wolfgang Lutz'], [1037, 'Jordan McQueen'], [1043, 'Christian Joudrey'], [1044, 'Steve Carter'],
  [1045, 'Aleksandra Boguslawska'], [1057, 'Stefan Kunze'], [110, 'Kenneth Thewissen'], [112, 'Zugr'],
];

// [馆藏编号, 画家, 作品名]
const ART: [string, string, string][] = [
  ['1980.262', 'Jean-Léon Gérôme', 'Alpine Landscape: The Handegg, Switzerland'],
  ['1935.217', 'John Henry Twachtman', 'Storm Clouds'],
  ['1951.330', 'Jean Baptiste Camille Corot', 'The Pond at the Entrance of the Woods'],
  ['1946.73', 'Claude Lorrain', 'Italian Landscape'],
  ['1973.2', 'Salomon van Ruysdael', 'Castle on a River'],
  ['1948.461', 'Julius Caesar Ibbetson', 'A Storm Behind the Isle of Wight'],
  ['1975.78', 'Georges Michel', 'Landscape Near Paris'],
  ['1942.121', 'Henry Ward Ranger', 'The Lone Sentinel'],
  ['1975.20', 'Worthington Whittredge', 'Landscape with Haywain'],
  ['1982.37', 'Albert Bierstadt', 'Fir Trees and Storm Clouds'],
  ['1980.245', 'Antoine Chintreuil', 'The Marl Pit at Mulcent: Evening'],
  ['1968.209', 'Jasper F. Cropsey', 'Mount Washington, New Hampshire'],
  ['1923.1118', 'Homer Dodge Martin', 'Wild Coast, Newport'],
  ['1946.255', 'John Frederick Kensett', 'View near Newport'],
  ['1927.387', 'George Inness', 'Durham, Connecticut'],
  ['1955.669', 'Jasper F. Cropsey', 'Gray Day on the Esopus'],
  ['1961.228', 'William Stanley Haseltine', 'Natural Bridge, Sorrento'],
  ['1922.358', 'Victor Charreton', 'Murol in the Snow'],
];

const CMA = 'https://openaccess-cdn.clevelandart.org';

export const CURATED: Record<CuratedCategory, CuratedWallpaper[]> = {
  nature: NATURE.map(([n, author]) => ({
    id: `picsum-${n}`,
    thumb: `https://picsum.photos/id/${n}/360/200`,
    full: `https://picsum.photos/id/${n}/2560/1440`,
    author,
    title: '',
  })),
  art: ART.map(([accession, author, title]) => ({
    id: `cma-${accession}`,
    thumb: `${CMA}/${accession}/${accession}_web.jpg`,
    full: `${CMA}/${accession}/${accession}_print.jpg`,
    author,
    title,
  })),
};

export function findCurated(id: string): CuratedWallpaper | undefined {
  return [...CURATED.nature, ...CURATED.art].find((item) => item.id === id);
}
