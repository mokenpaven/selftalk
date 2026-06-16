import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { VoiceRecorder } from './VoiceRecorder';
import { ThemePalette } from '../theme/themes';

interface MessageInputProps {
  onSendText: (text: string) => void;
  onSendImage: (base64: string) => void;
  onSendFile: (file: { uri: string; name: string; size: number }) => void;
  onSendVoice: (data: { uri: string; durationMs: number }) => void;
  onInputFocus?: () => void;
  bottomInset: number;
  theme: ThemePalette;
}

export function MessageInput({
  onSendText,
  onSendImage,
  onSendFile,
  onSendVoice,
  onInputFocus,
  bottomInset,
  theme,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = () => {
    if (text.trim()) {
      onSendText(text.trim());
      setText('');
    }
  };

  const handleImagePick = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar imágenes');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        onSendImage(base64Image);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para tomar fotos');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        onSendImage(base64Image);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        onSendFile({ uri: file.uri, name: file.name, size: file.size || 0 });
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const showAttachmentMenu = () => {
    Alert.alert(
      'Adjuntar',
      'Selecciona una opción',
      [
        { text: 'Cámara', onPress: handleCameraCapture },
        { text: 'Galería', onPress: handleImagePick },
        { text: 'Archivo', onPress: handleFilePick },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleStartRecording = () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'La grabación de voz solo está disponible en dispositivos móviles');
      return;
    }
    setIsRecording(true);
  };

  const handleRecordingComplete = (data: { uri: string; durationMs: number }) => {
    setIsRecording(false);
    onSendVoice(data);
  };

  const bottomPadding = keyboardVisible ? 0 : Math.max(bottomInset, 8);

  if (isRecording) {
    return (
      <View
        style={[
          styles.recordingWrapper,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        <VoiceRecorder
          onCancel={() => setIsRecording(false)}
          onComplete={handleRecordingComplete}
          theme={theme}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <Pressable
          onPress={showAttachmentMenu}
          style={({ pressed }) => [
            styles.attachButton,
            { backgroundColor: theme.surfaceAlt },
            pressed && styles.buttonPressed,
          ]}
          testID="attach-button"
        >
          <Ionicons name="add" size={24} color={theme.primary} />
        </Pressable>

        <View style={[styles.inputContainer, { backgroundColor: theme.inputBg }]}>
          <TextInput
            style={[styles.input, { color: theme.inputText }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={theme.placeholder}
            value={text}
            onChangeText={setText}
            onFocus={onInputFocus}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            multiline
            maxLength={5000}
            testID="message-input"
            accessibilityLabel="Campo de entrada de mensaje"
          />
        </View>

        {text.trim() ? (
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            testID="send-button"
          >
            <Ionicons name="send" size={20} color={theme.onPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleStartRecording}
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: theme.primary, shadowColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            testID="voice-button"
          >
            <Ionicons name="mic" size={20} color={theme.onPrimary} />
          </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  recordingWrapper: {
    borderTopWidth: 1,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 120,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  input: {
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 110,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
