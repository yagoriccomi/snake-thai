import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

/** Arquivo escolhido pelo usuário para envio como comprovante. */
export interface PickedFile {
  uri: string;
  name: string;
  contentType: string;
  /** base64 já disponível (imagens) — evita reler o arquivo no upload. */
  base64?: string;
}

/** Seleciona uma imagem (JPG/PNG) da galeria; retorna `null` se cancelado/negado. */
export async function pickImageProof(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled) {
    return null;
  }
  const asset = result.assets[0];
  if (asset === undefined) {
    return null;
  }
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'comprovante.jpg',
    contentType: asset.mimeType ?? 'image/jpeg',
    base64: asset.base64 ?? undefined,
  };
}

/** Seleciona um documento (PDF ou imagem); retorna `null` se cancelado. */
export async function pickDocumentProof(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return null;
  }
  const asset = result.assets[0];
  if (asset === undefined) {
    return null;
  }
  return {
    uri: asset.uri,
    name: asset.name,
    contentType: asset.mimeType ?? 'application/octet-stream',
  };
}
