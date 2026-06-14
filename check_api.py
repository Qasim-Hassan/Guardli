import os
from google import genai

def gemini_api_test():
    api_keys = os.environ.get("GEMINI_PRIMARY_KEY"), os.environ.get("GEMINI_SECONDARY_KEY")
    index_api_number = 0
    while index_api_number < len(api_keys):
        try:
            client_bot = genai.Client(api_keys[index_api_number])
            client_bot.models.generate_content(
                model = 'gemma-4-31b-it',
                contents = 'Test'
            )
            print("Success")
            return client_bot
        except:
            print("Failed moving to backup key")
            index_api_number+=1
            
    print("All available API keys have failed.")
    return None