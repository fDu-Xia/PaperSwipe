package site.paperswipe.app;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

// Requires an emulator/device. Compilation alone does not run this test.
@RunWith(AndroidJUnit4.class)
public class AppSecurityTest {
    @Test
    public void packageDisablesCleartextAndBackup() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("site.paperswipe.app", context.getPackageName());
        assertEquals(0, context.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertFalse(NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted());
    }
}
