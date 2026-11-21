import Foundation
import CoreGraphics
if CommandLine.arguments.dropFirst().elementsEqual(["--request-permission"]) {
    _ = CGRequestScreenCaptureAccess()
    exit(EXIT_SUCCESS)
}
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let result = windows.filter { ($0[kCGWindowLayer as String] as? Int) == 0 }.map { w -> [String: Any] in
 ["id": w[kCGWindowNumber as String] ?? 0, "app": w[kCGWindowOwnerName as String] ?? "", "title": w[kCGWindowName as String] ?? "", "bounds": w[kCGWindowBounds as String] ?? [:]]
}
let data = try JSONSerialization.data(withJSONObject: ["permission": CGPreflightScreenCaptureAccess(), "windows":result], options:[.sortedKeys])
print(String(data:data, encoding:.utf8)!)
