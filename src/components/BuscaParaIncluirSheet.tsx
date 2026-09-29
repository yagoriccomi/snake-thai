import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('BuscaParaIncluirSheet');

/** A busca do banco aceita de 2 a 60 caracteres (§ 7.2). */
const MINIMO_DA_BUSCA = 2;
const MAXIMO_DA_BUSCA = 60;
/** Espera o usuário parar de digitar antes de ir ao banco. */
const ATRASO_DA_BUSCA_MS = 300;

export interface ResultadoDaBusca {
  id: string;
  titulo: string;
  subtitulo: string | null;
  /** Cor do professor, quando houver. */
  cor: string | null;
}

interface BuscaParaIncluirSheetProps {
  visible: boolean;
  titulo: string;
  explicacao: string;
  rotuloDoCampo: string;
  buscar: (texto: string) => Promise<ResultadoDaBusca[]>;
  onEscolher: (resultado: ResultadoDaBusca) => void;
  onClose: () => void;
}

/**
 * Busca para incluir um aluno que apareceu ou acrescentar um professor que
 * não estava previsto (D5, D27). Carregando, erro e "ninguém encontrado"
 * aparecem na própria folha. [#93]
 */
export function BuscaParaIncluirSheet({
  visible,
  titulo,
  explicacao,
  rotuloDoCampo,
  buscar,
  onEscolher,
  onClose,
}: BuscaParaIncluirSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ResultadoDaBusca[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pedidoRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      setTexto('');
      setResultados(null);
      setErro(null);
    }
  }, [visible]);

  useEffect(() => {
    const termo = texto.trim();
    if (termo.length < MINIMO_DA_BUSCA) {
      setResultados(null);
      setBuscando(false);
      return undefined;
    }
    const pedido = pedidoRef.current + 1;
    pedidoRef.current = pedido;
    setBuscando(true);
    setErro(null);
    const timer = setTimeout(() => {
      buscar(termo)
        .then((achados) => {
          if (pedidoRef.current === pedido) setResultados(achados);
        })
        .catch((falha: unknown) => {
          log.warn('Falha na busca para incluir', falha);
          if (pedidoRef.current === pedido) setErro(describeError(falha));
        })
        .finally(() => {
          if (pedidoRef.current === pedido) setBuscando(false);
        });
    }, ATRASO_DA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [texto, buscar]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        {titulo}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {explicacao}
      </AppText>
      <Input
        label={rotuloDoCampo}
        value={texto}
        onChangeText={setTexto}
        maxLength={MAXIMO_DA_BUSCA}
        autoCorrect={false}
        autoCapitalize="words"
        placeholder="Digite pelo menos 2 letras do nome"
      />
      {buscando ? <ActivityIndicator color={colors.primary} accessibilityLabel="Buscando" /> : null}
      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erro}
        </AppText>
      ) : null}
      {!buscando && erro === null && resultados !== null && resultados.length === 0 ? (
        <AppText variant="caption" color={colors.textSecondary}>
          Ninguém encontrado com esse nome.
        </AppText>
      ) : null}
      {!buscando && resultados !== null
        ? resultados.map((resultado) => (
            <Pressable
              key={resultado.id}
              onPress={() => onEscolher(resultado)}
              style={styles.resultado}
              accessibilityRole="button"
              accessibilityLabel={`Escolher ${resultado.titulo}`}
            >
              {resultado.cor !== null ? <View style={[styles.ponto, { backgroundColor: resultado.cor }]} /> : null}
              <View style={styles.textos}>
                <Text style={styles.titulo}>{resultado.titulo}</Text>
                {resultado.subtitulo !== null ? <Text style={styles.subtitulo}>{resultado.subtitulo}</Text> : null}
              </View>
              <Ionicons name="add-circle-outline" size={22} color={colors.primaryText} />
            </Pressable>
          ))
        : null}
      <Button title="Fechar" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    resultado: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    ponto: { width: 10, height: 10, borderRadius: 5 },
    textos: { flex: 1, gap: 2 },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    subtitulo: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  });
}
