import {renderHook,act} from "@testing-library/react";
import {useLocalPreference,readBoolean} from "@/hooks/useLocalPreference";
afterEach(()=>{jest.restoreAllMocks();localStorage.clear();});
test("reads the stored preference without overwriting it on mount",()=>{
 localStorage.setItem("preference-test","true");const writes=jest.spyOn(Storage.prototype,"setItem");
 const {result}=renderHook(()=>useLocalPreference("preference-test",false,readBoolean));expect(result.current[0]).toBe(true);expect(writes).not.toHaveBeenCalled();
});
test("notifies other mounted consumers and handles cross-tab changes",()=>{
 const first=renderHook(()=>useLocalPreference("preference-test",false,readBoolean));const second=renderHook(()=>useLocalPreference("preference-test",false,readBoolean));
 act(()=>first.result.current[1](true));expect(second.result.current[0]).toBe(true);
 act(()=>{localStorage.setItem("preference-test","false");window.dispatchEvent(new StorageEvent("storage",{key:"preference-test"}));});expect(first.result.current[0]).toBe(false);expect(second.result.current[0]).toBe(false);
});
