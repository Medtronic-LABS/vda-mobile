package in.gov.abdm.vdahealth;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register before BridgeActivity creates the Capacitor bridge.
        registerPlugin(EsanjeevaniLauncherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
