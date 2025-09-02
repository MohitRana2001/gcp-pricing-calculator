import requests
import json
import base64
import uuid
import sys
import os
import compute_engine_calculator_pb2 as calculator_pb2

# --- DEFINE YOUR CREDENTIALS HERE ---
# In a real application, you should load these from environment variables
# For example: os.getenv("GCP_AT_TOKEN")
AT_TOKEN = os.getenv("AT_TOKEN")
F_SID = os.getenv("F_SID")
BL_VERSION = os.getenv("BL_VERSION")


def generate_single_link(auth_token, f_sid, bl_version, config):
    try:
        # --- STEP 1: INTELLIGENTLY MODIFY THE "GOLDEN REQUEST" TEMPLATE ---
        print("--> Modifying template with full config...", file=sys.stderr)
        
        # This is a template from a default e2-standard-2 instance.
        # We will replace all its key values with the data from your config.
        f_req_template = '[[["jUj4td","[null,null,null,null,null,[[8,\\"FORM_ID_UUID\\",null,1,9,null,\\"Compute Engine\\",\\"Instances\\",\\"Compute Engine\\",[142,130,114,110,112],[[9,[[102,[null,null,null,null,null,null,null,null,[null,null,[128,[null,null,null,null,null,null,null,null,null,1],\\"Number of Instances\\"],[129,[null,null,null,null,4,null,null,7,null,730],\\"Instance-time\\"]]]],[106,[\\"free-debian-centos-coreos-ubuntu-or-byol-bring-your-own-license\\"]],[107,[\\"regular\\"]],[108,[null,null,null,null,null,null,[null,null,null,[130,[\\"e2-standard-2\\"],\\"Machine type\\"],[131,[\\"2\\"],\\"Number of vCPUs\\"],[132,[\\"8\\"],\\"Amount of memory\\"],[141,[\\"general-purpose\\"],\\"Machine Family\\"],[142,[\\"e2\\"],\\"Series\\"]]]],[115,[\\"us-central1\\"],\\"Region\\"],[116,[\\"none\\"],\\"Committed use discount options\\",\\"None\\"]]],[10,[]],[21,[]]],null,\\"Instances\\"]],\\"USD\\",null,\\"ESTIMATE_ID_UUID\\"]",null,"generic"]]]'

        # Generate unique IDs for this specific request
        form_id_uuid = str(uuid.uuid4()).upper()
        estimate_id_uuid = str(uuid.uuid4()).upper()

        # Perform a series of replacements to inject the new config
        modified_freq = f_req_template.replace("FORM_ID_UUID", form_id_uuid)
        modified_freq = modified_freq.replace("ESTIMATE_ID_UUID", estimate_id_uuid)
        
        # 1. Quantity (Number of Instances)
        modified_freq = modified_freq.replace(
            ',[null,null,null,null,null,null,null,null,null,1],\\"Number of Instances\\"',
            f',[null,null,null,null,null,null,null,null,null,{config["quantity"]}],\\"Number of Instances\\"'
        )
        
        # 2. Machine Type Name (e.g., "e2-standard-2")
        modified_freq = modified_freq.replace('e2-standard-2', config["name"])
        
        # 3. vCPU Count
        modified_freq = modified_freq.replace('[\\"2\\"],\\"Number of vCPUs\\"', f'[\\"{config["vCpus"]}\\"],\\"Number of vCPUs\\"')

        # 4. Memory Amount
        modified_freq = modified_freq.replace('[\\"8\\"],\\"Amount of memory\\"', f'[\\"{config["memoryGB"]}\\"],\\"Amount of memory\\"')

        # 5. Machine Series
        modified_freq = modified_freq.replace('[\\"e2\\"],\\"Series\\"', f'[\\"{config["series"]}\\"],\\"Series\\"')

        # 6. Region
        modified_freq = modified_freq.replace('[\\"us-central1\\"],\\"Region\\"', f'[\\"{config["regionLocation"]}\\"],\\"Region\\"')

        # 7. Operating System (OS)
        if "os" in config:
            os_mapping = {
                "linux": "free-debian-centos-coreos-ubuntu-or-byol-bring-your-own-license",
                "windows": "windows-server",
                "rhel": "paid-red-hat-enterprise-linux",
                "rhel_sap": "paid-red-hat-enterprise-linux-for-sap-with-ha-and-update-services",
                "sles": "paid-sles",
                "sles_sap": "paid-sles-12-for-sap",
                "ubuntu_pro": "paid-ubuntu-pro"
            }
            os_value = os_mapping.get(config["os"], "free-debian-centos-coreos-ubuntu-or-byol-bring-your-own-license")
            modified_freq = modified_freq.replace('[\\"free-debian-centos-coreos-ubuntu-or-byol-bring-your-own-license\\"]', f'[\\"{os_value}\\"]')

        # 8. Provisioning Model
        if "provisioningModel" in config:
            provisioning_value = config["provisioningModel"]
            modified_freq = modified_freq.replace('[\\"regular\\"]', f'[\\"{provisioning_value}\\"]')

        # 9. Running Hours (Instance-time)
        if "runningHours" in config:
            modified_freq = modified_freq.replace(
                ',[null,null,null,null,4,null,null,7,null,730],\\"Instance-time\\"',
                f',[null,null,null,null,4,null,null,7,null,{config["runningHours"]}],\\"Instance-time\\"'
            )
            
        if "commitment" in config:
            commitment_value = config["commitment"]
            modified_freq = modified_freq.replace('[\\"none\\"],\\"Committed use discount options\\"', f'[\\"{commitment_value}\\"],\\"Committed use discount options\\"')

        # --- STEP 2: MAKE THE API CALL ---
        print("--> Submitting intelligently modified data...", file=sys.stderr)
        request_url = "https://cloud.google.com/_/GoogleCloudUxWebAppCgcUi/data/batchexecute"
        params = {
            'rpcids': 'jUj4td', 'source-path': '/products/calculator', 'f.sid': f_sid,
            'bl': bl_version, 'hl': 'en', 'soc-app': '1', 'soc-platform': '1',
            'soc-device': '1', '_reqid': str(uuid.uuid4().int >> 64)[:6], 'rt': 'c'
        }
        payload = {'f.req': modified_freq, 'at': auth_token}

        response = requests.post(request_url, params=params, data=payload)
        response.raise_for_status()
    
    except requests.exceptions.HTTPError as e:
        print(f"HTTPError: The server returned a {e.response.status_code} error.", file=sys.stderr)
        print(f"Response Body: {e.response.text}", file=sys.stderr)
        sys.exit(1) # Exit with error for the backend to catch
    except KeyError as e:
        print(f"KeyError: The configuration object from the frontend is missing the key: {e}", file=sys.stderr)
        sys.exit(1)

    # --- STEP 3: PARSE RESPONSE AND BUILD FINAL URL ---
    try:
        print("--> Parsing response and building the final URL...", file=sys.stderr)
        response_text = response.text
        json_start_index = response_text.find('[')
        clean_response_text = response_text[json_start_index:]
        decoder = json.JSONDecoder()
        pos = 0
        estimate_id = None
        while pos < len(clean_response_text):
            obj, pos = decoder.raw_decode(clean_response_text, pos)
            if (isinstance(obj, list) and obj and isinstance(obj[0], list) and
                    obj[0] and obj[0][0] == 'wrb.fr'):
                inner_payload_str = obj[0][2]
                inner_payload_json = json.loads(inner_payload_str)
                estimate_id = inner_payload_json[0][0].replace('\\u003d', '=')
                break
        
        if not estimate_id:
            raise ValueError("Could not find estimate_id in the server response.")
            
        deeplink_query = calculator_pb2.PricingDeeplinkQuery(estimate_id=estimate_id)
        serialized_deeplink = deeplink_query.SerializeToString()
        base64_encoded_deeplink = base64.urlsafe_b64encode(serialized_deeplink).decode('utf-8').rstrip('=')
        
        return f"https://cloud.google.com/calculator?dl={base64_encoded_deeplink}"

    except (Exception) as e:
        print(f"Error processing the server response: {e}", file=sys.stderr)
        print(f"Full Response Text: {response.text}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Error: Missing configuration JSON as a command-line argument.", file=sys.stderr)
        sys.exit(1)

    try:
        config_arg = sys.argv[1]
        config_data = json.loads(config_arg)

        if "PASTE" in AT_TOKEN:
             print("Error: Please edit the script and provide fresh credentials.", file=sys.stderr)
             sys.exit(1)

        final_link = generate_single_link(
            AT_TOKEN, F_SID, BL_VERSION, config_data
        )
        print(final_link)

    except Exception as e:
        print(f"A critical error occurred: {e}", file=sys.stderr)
        sys.exit(1)