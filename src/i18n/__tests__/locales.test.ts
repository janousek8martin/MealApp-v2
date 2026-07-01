import cs from '../locales/cs.json';
import en from '../locales/en.json';

type Tree = { [key: string]: string | Tree };

function collectKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : collectKeys(value, path);
  });
}

describe('locale resources', () => {
  it('cs and en contain exactly the same keys', () => {
    expect(collectKeys(cs as Tree).sort()).toEqual(collectKeys(en as Tree).sort());
  });

  it('no message is empty', () => {
    for (const tree of [cs, en]) {
      const walk = (node: Tree) => {
        for (const value of Object.values(node)) {
          if (typeof value === 'string') {
            expect(value.trim()).not.toHaveLength(0);
          } else {
            walk(value);
          }
        }
      };
      walk(tree as Tree);
    }
  });
});
