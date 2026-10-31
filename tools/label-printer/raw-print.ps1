# Sends a file to a Windows printer as RAW data, so the printer receives the
# TSPL commands exactly as written and the driver does not try to draw a page.
#
# Called by server.mjs:  raw-print.ps1 -PrinterName "TSC TE244" -Path job.tspl

param(
    [Parameter(Mandatory = $true)][string]$PrinterName,
    [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DOC_INFO_1
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string printerName, out IntPtr printer, IntPtr defaults);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr printer);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool StartDocPrinter(IntPtr printer, int level, ref DOC_INFO_1 docInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr printer);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr printer);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr printer);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr printer, byte[] bytes, int count, out int written);

    private static void Fail(string what)
    {
        int code = Marshal.GetLastWin32Error();
        throw new InvalidOperationException(
            what + ": " + new Win32Exception(code).Message + " (Windows error " + code + ")");
    }

    public static void Send(string printerName, byte[] data)
    {
        IntPtr printer;
        if (!OpenPrinter(printerName, out printer, IntPtr.Zero))
        {
            Fail("Could not open printer '" + printerName + "'");
        }

        try
        {
            DOC_INFO_1 doc = new DOC_INFO_1();
            doc.pDocName = "OptiSource label";
            doc.pOutputFile = null;
            doc.pDatatype = "RAW";

            if (!StartDocPrinter(printer, 1, ref doc)) Fail("Could not start the print job");
            try
            {
                if (!StartPagePrinter(printer)) Fail("Could not start the print page");
                try
                {
                    int written;
                    if (!WritePrinter(printer, data, data.Length, out written) || written != data.Length)
                    {
                        Fail("Could not send the label to the printer");
                    }
                }
                finally { EndPagePrinter(printer); }
            }
            finally { EndDocPrinter(printer); }
        }
        finally { ClosePrinter(printer); }
    }
}
'@

try {
    Add-Type -TypeDefinition $source
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    [RawPrinter]::Send($PrinterName, $bytes)
}
catch {
    # A .NET method call reaches here wrapped; the useful message is inside.
    $problem = $_.Exception
    if ($problem.InnerException) { $problem = $problem.InnerException }
    [Console]::Error.WriteLine($problem.Message)
    exit 1
}
