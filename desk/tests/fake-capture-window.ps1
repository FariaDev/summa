param([ValidateSet('target','cover','inspect')][string]$Role,[string]$Png)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @'
using System.Runtime.InteropServices;
public class CaptureFixture { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
'@
[void][CaptureFixture]::SetProcessDPIAware()
if($Role -eq 'inspect'){
 $bitmap=[System.Drawing.Bitmap]::FromFile($Png)
 $target=0; $cover=0
 for($x=0;$x -lt $bitmap.Width;$x+=4){
  for($y=0;$y -lt $bitmap.Height;$y+=4){
   $pixel=$bitmap.GetPixel($x,$y)
   if($pixel.R -eq 0 -and $pixel.G -eq 255 -and $pixel.B -eq 0){$target++}
   if($pixel.R -eq 255 -and $pixel.G -eq 0 -and $pixel.B -eq 255){$cover++}
  }
 }
 $bitmap.Dispose()
 @{target=$target;cover=$cover} | ConvertTo-Json -Compress
 exit
}
$form=New-Object System.Windows.Forms.Form
$form.Text="Capture fixture $Role"
$form.StartPosition='Manual'
$form.TopMost=$true
if($Role -eq 'target'){
 $form.Location=New-Object System.Drawing.Point 80,80
 $form.Size=New-Object System.Drawing.Size 600,450
 $form.BackColor=[System.Drawing.Color]::Lime
}else{
 $form.Location=New-Object System.Drawing.Point 240,180
 $form.Size=New-Object System.Drawing.Size 300,200
 $form.BackColor=[System.Drawing.Color]::Magenta
}
$form.Add_Shown({$form.Refresh(); [Console]::Out.WriteLine('READY')})
[System.Windows.Forms.Application]::Run($form)
