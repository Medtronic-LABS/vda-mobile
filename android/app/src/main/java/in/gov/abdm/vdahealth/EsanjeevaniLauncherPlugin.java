package in.gov.abdm.vdahealth;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens only the known official eSanjeevani Android package, when installed. */
@CapacitorPlugin(name = "EsanjeevaniLauncher")
public class EsanjeevaniLauncherPlugin extends Plugin {
    private static final String OFFICIAL_PACKAGE = "hied.esanjeevaniabopd.com";

    @PluginMethod
    public void open(PluginCall call) {
        Intent launchIntent = getContext().getPackageManager().getLaunchIntentForPackage(OFFICIAL_PACKAGE);
        JSObject result = new JSObject();
        if (launchIntent == null) {
            result.put("openedApp", false);
            call.resolve(result);
            return;
        }
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(launchIntent);
        result.put("openedApp", true);
        call.resolve(result);
    }
}
