package site.paperswipe.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

// Store only the revocable session (not the invite or model API key).
// AES-GCM key material is non-exportable in Android Keystore; encrypted data
// stays in app-private storage and is explicitly excluded from backups.
@CapacitorPlugin(name = "SessionVault")
public class SessionVaultPlugin extends Plugin {
    private static final String ALIAS = "paperswipe.session.v1";
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("session_vault", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }
    @PluginMethod
    public synchronized void get(PluginCall call) {
        String stored = prefs().getString("ciphertext", null);
        JSObject result = new JSObject();
        if (stored == null) { result.put("token", ""); call.resolve(result); return; }
        try {
            byte[] iv = Base64.decode(prefs().getString("iv", ""), Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            String token = new String(cipher.doFinal(Base64.decode(stored, Base64.NO_WRAP)), StandardCharsets.UTF_8);
            if (!token.matches("[a-f0-9]{64}")) throw new IllegalStateException("invalid session");
            result.put("token", token);
            call.resolve(result);
        } catch (Exception error) {
            // Reinstall/device transfer/invalidated key: require a fresh login.
            if (!prefs().edit().clear().commit()) { call.reject("无法清除失效登录状态"); return; }
            result.put("token", ""); call.resolve(result);
        }
    }
    @PluginMethod
    public synchronized void set(PluginCall call) {
        String token = call.getString("token", "");
        if (!token.matches("[a-f0-9]{64}")) { call.reject("登录状态格式无效"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            String encrypted = Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            boolean saved = prefs().edit().putString("ciphertext", encrypted)
                .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit();
            if (!saved) { call.reject("无法保存登录状态"); return; }
            call.resolve();
        } catch (Exception error) { call.reject("安全存储暂不可用，请重试"); }
    }
    @PluginMethod
    public synchronized void clear(PluginCall call) {
        if (prefs().edit().clear().commit()) call.resolve();
        else call.reject("无法清除登录状态，请重试");
    }
}
