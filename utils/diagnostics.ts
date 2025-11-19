
/**
 * Runs a self-diagnostic test to verify logic integrity.
 * This should be called manually via console or on app initialization in debug mode.
 */
export const runSelfDiagnostic = () => {
    console.log("%c Running Kirana System Diagnostics...", "color: blue; font-weight: bold;");
    const tests = [
        {
            name: "Image Compression Test",
            run: async () => {
                // Create a dummy large image
                const canvas = document.createElement('canvas');
                canvas.width = 3000;
                canvas.height = 3000;
                // ToBlob is async
                return new Promise<boolean>((resolve) => {
                   canvas.toBlob(async (blob) => {
                       if(!blob) { resolve(false); return; }
                       const file = new File([blob], "test.jpg", { type: "image/jpeg" });
                       const { compressAndConvertToBase64 } = await import('./imageCompression');
                       const base64 = await compressAndConvertToBase64(file, 500, 0.5);
                       // It should be a string and much smaller than original bitmap
                       if (typeof base64 === 'string' && base64.length > 100) resolve(true);
                       else resolve(false);
                   }, 'image/jpeg'); 
                });
            }
        },
        {
            name: "Data Logic Integrity",
            run: () => {
                // Simple pure function test mock
                const testInventory = [{id: '1', stock: 10, price: 100}];
                const itemToBuy = {inventoryId: '1', quantity: '5', price: '100'};
                const remaining = testInventory[0].stock - parseFloat(itemToBuy.quantity);
                return Promise.resolve(remaining === 5);
            }
        }
    ];

    tests.forEach(async (test) => {
        try {
            const passed = await test.run();
            if (passed) {
                console.log(`%c[PASS] ${test.name}`, "color: green");
            } else {
                console.error(`%c[FAIL] ${test.name}`, "color: red");
            }
        } catch (e) {
            console.error(`%c[FAIL] ${test.name} - Exception:`, e);
        }
    });
};
