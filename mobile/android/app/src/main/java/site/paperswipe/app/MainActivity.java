package site.paperswipe.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SessionVaultPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
