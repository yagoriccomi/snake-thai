import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

interface PortalEntry {
  key: string;
  node: React.ReactNode;
}

interface PortalContextValue {
  mount: (key: string, node: React.ReactNode) => void;
  unmount: (key: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

/**
 * Hospeda, na raiz do app, o conteúdo que precisa ficar ACIMA de tudo — folhas
 * inferiores, sobreposições — sem abrir uma janela nova.
 *
 * Por que não `Modal`: com edge-to-edge (obrigatório no SDK 57), o `Modal` do
 * Android é um Dialog com janela própria, e o React Native só detecta o
 * teclado pela janela da Activity (`ReactRootView.checkForKeyboardEvents`).
 * Dentro de um Modal, nenhum `KeyboardAvoidingView` recebe o evento e o
 * teclado cobre o campo em que se digita. Renderizado aqui, o conteúdo fica na
 * janela principal e o teclado é visto.
 *
 * O conteúdo herda os contextos de onde o provider está (tema, autenticação),
 * não os de onde o `Portal` foi declarado — por isso fica fora da navegação.
 */
export function PortalProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [entries, setEntries] = useState<readonly PortalEntry[]>([]);

  const mount = useCallback((key: string, node: React.ReactNode) => {
    setEntries((previous) => {
      const index = previous.findIndex((entry) => entry.key === key);
      if (index === -1) {
        return [...previous, { key, node }];
      }
      const next = [...previous];
      next[index] = { key, node };
      return next;
    });
  }, []);

  const unmount = useCallback((key: string) => {
    setEntries((previous) => previous.filter((entry) => entry.key !== key));
  }, []);

  const value = useMemo(() => ({ mount, unmount }), [mount, unmount]);

  return (
    <PortalContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {entries.map((entry) => (
          <React.Fragment key={entry.key}>{entry.node}</React.Fragment>
        ))}
      </View>
    </PortalContext.Provider>
  );
}

/**
 * Renderiza `children` no `PortalProvider` mais próximo. Os filhos são
 * reenviados a cada render de quem declarou o Portal, então props e estado
 * continuam vivos — não é uma "foto" tirada na abertura.
 */
export function Portal({ children }: { children: React.ReactNode }): null {
  const context = useContext(PortalContext);
  const key = useId();
  if (context === null) {
    throw new Error('Portal precisa estar dentro de um PortalProvider.');
  }
  const { mount, unmount } = context;

  useLayoutEffect(() => {
    mount(key, children);
  }, [mount, key, children]);

  useLayoutEffect(() => () => unmount(key), [unmount, key]);

  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
