import {
  dateBrToIso,
  dateIsoToBr,
  maskCpf,
  maskDate,
  maskPhone,
  onlyDigits,
} from '@/utils/masks';

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('(11) 99999-8888')).toBe('11999998888');
    expect(onlyDigits('abc123')).toBe('123');
  });
});

describe('maskCpf', () => {
  it('formata progressivamente e limita a 11 dígitos', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('529982247259999')).toBe('529.982.247-25');
    expect(maskCpf('529')).toBe('529');
  });
});

describe('maskPhone', () => {
  it('formata celular de 11 dígitos', () => {
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
  });
  it('formata número de 10 dígitos', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
  });
});

describe('maskDate', () => {
  it('formata como DD/MM/AAAA', () => {
    expect(maskDate('31121990')).toBe('31/12/1990');
    expect(maskDate('3112')).toBe('31/12');
  });
});

describe('conversão de datas', () => {
  it('DD/MM/AAAA -> ISO e volta', () => {
    expect(dateBrToIso('31/12/1990')).toBe('1990-12-31');
    expect(dateBrToIso('31/12')).toBeNull();
    expect(dateIsoToBr('1990-12-31')).toBe('31/12/1990');
  });
});
