import { ehUrlDeAnexoConfiavel } from '@/utils/url';

describe('ehUrlDeAnexoConfiavel (REVIEW-FASE4 S3)', () => {
  it('deveAceitarSoHttpsDoCloudinary', () => {
    expect(ehUrlDeAnexoConfiavel('https://res.cloudinary.com/snake/image/authenticated/s--x--/justificativas/a/b')).toBe(true);
    expect(ehUrlDeAnexoConfiavel('http://res.cloudinary.com/snake/x')).toBe(false);
    expect(ehUrlDeAnexoConfiavel('https://res.cloudinary.com.evil.io/x')).toBe(false);
    expect(ehUrlDeAnexoConfiavel('intent://abrir#Intent;end')).toBe(false);
    expect(ehUrlDeAnexoConfiavel('javascript:alert(1)')).toBe(false);
  });
});
