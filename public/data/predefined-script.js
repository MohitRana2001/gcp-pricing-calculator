const fs = require('fs');

// --- CONFIGURATION ---

const MACHINE_DATA_PATH = 'public/data/machine-data.json';
const CUSTOM_EXTENDED_PATH = 'public/data/custom-extended.json';
const OUTPUT_PATH = './custom-extended-updated.json';
const HOURS_IN_MONTH = 730;

// Series that support custom machines
const SERIES_TO_PROCESS = ['e2', 'n1', 'n2', 'n2d'];

// Regions specified in the request
const REGIONS_TO_PROCESS = [
    'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2',
    'asia-northeast3', 'asia-south1', 'asia-south2', 'asia-southeast1',
    'asia-southeast2', 'australia-southeast1', 'australia-southeast2'
];

// --- HELPER FUNCTIONS ---

/**
 * Solves a system of two linear equations:
 * a1*x + b1*y = c1
 * a2*x + b2*y = c2
 * @returns {{x: number, y: number} | null} The solution for x and y, or null if not solvable.
 */
function solveLinearEquations(a1, b1, c1, a2, b2, c2) {
    const determinant = a1 * b2 - a2 * b1;

    if (determinant === 0) {
        // The system is not solvable (lines are parallel or coincident)
        return null;
    }

    const x = (c1 * b2 - c2 * b1) / determinant;
    const y = (a1 * c2 - a2 * c1) / determinant;

    return { x, y };
}

// --- MAIN LOGIC ---

function processPricingData() {
    console.log("Starting pricing calculation script...");

    // 1. Load data files
    let machineData;
    let customExtendedData;
    try {
        machineData = JSON.parse(fs.readFileSync(MACHINE_DATA_PATH, 'utf-8'));
        customExtendedData = JSON.parse(fs.readFileSync(CUSTOM_EXTENDED_PATH, 'utf-8'));
        console.log("Successfully loaded machine-data.json and custom-extended.json.");
    } catch (error) {
        console.error("Error reading input files:", error.message);
        return;
    }

    // 2. Iterate through each series and region
    for (const series of SERIES_TO_PROCESS) {
        for (const region of REGIONS_TO_PROCESS) {
            console.log(`\nProcessing Series: ${series}, Region: ${region}`);

            // Find two suitable machines with different vCPU/memory ratios
            // Best pair: standard-2 and highmem-2
            const machine1 = machineData.find(m => m.series === series && m.region === region && m.name.endsWith('-standard-2'));
            const machine2 = machineData.find(m => m.series === series && m.region === region && m.name.endsWith('-highmem-2'));

            if (!machine1 || !machine2) {
                console.warn(`  -> Could not find standard-2 and highmem-2 machines. Skipping.`);
                continue;
            }

            // Extract vCPU and Memory configurations
            const vcpu1 = parseInt(machine1.vCpus, 10);
            const mem1 = parseFloat(machine1.memoryGB);
            const vcpu2 = parseInt(machine2.vCpus, 10);
            const mem2 = parseFloat(machine2.memoryGB);

            // Calculate hourly CUD prices from monthly data
            const price1_1y = parseFloat(machine1.month1yCud) / HOURS_IN_MONTH;
            const price1_3y = parseFloat(machine1.month3yCud) / HOURS_IN_MONTH;
            const price2_1y = parseFloat(machine2.month1yCud) / HOURS_IN_MONTH;
            const price2_3y = parseFloat(machine2.month3yCud) / HOURS_IN_MONTH;

            // 3. Solve for 1-Year CUD predefined prices
            const solution1y = solveLinearEquations(vcpu1, mem1, price1_1y, vcpu2, mem2, price2_1y);

            // 4. Solve for 3-Year CUD predefined prices
            const solution3y = solveLinearEquations(vcpu1, mem1, price1_3y, vcpu2, mem2, price2_3y);

            if (!solution1y || !solution3y) {
                console.error(`  -> Could not solve equations for ${series} in ${region}. The machine data might be linearly dependent.`);
                continue;
            }

            const { x: vcpuPrice1y, y: memPrice1y } = solution1y;
            const { x: vcpuPrice3y, y: memPrice3y } = solution3y;

            console.log(`  -> Calculated 1Y Predefined: vCPU=$${vcpuPrice1y.toFixed(6)}, Memory=$${memPrice1y.toFixed(6)}`);
            console.log(`  -> Calculated 3Y Predefined: vCPU=$${vcpuPrice3y.toFixed(6)}, Memory=$${memPrice3y.toFixed(6)}`);

            // 5. Inject the new predefined prices into the customExtendedData object
            const pricingPath = customExtendedData[series]?.[region];
            if (pricingPath) {
                // Inject into vCPU pricing
                pricingPath['Custom vCPUs'].pricing['Predefined CUD - 1 Year (USD)'] = vcpuPrice1y.toFixed(6);
                pricingPath['Custom vCPUs'].pricing['Predefined CUD - 3 Year (USD)'] = vcpuPrice3y.toFixed(6);
                // Inject into Memory pricing
                pricingPath['Custom Memory'].pricing['Predefined CUD - 1 Year (USD)'] = memPrice1y.toFixed(6);
                pricingPath['Custom Memory'].pricing['Predefined CUD - 3 Year (USD)'] = memPrice3y.toFixed(6);
                console.log("  -> Successfully injected new prices into the JSON structure.");
            } else {
                console.warn(`  -> Could not find path in custom-extended.json for ${series} in ${region}.`);
            }
        }
    }

    // 6. Save the updated data to a new file
    try {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(customExtendedData, null, 2));
        console.log(`\n✅ Success! Updated pricing data has been saved to ${OUTPUT_PATH}`);
    } catch (error) {
        console.error("Error writing output file:", error.message);
    }
}

// Run the script
processPricingData();