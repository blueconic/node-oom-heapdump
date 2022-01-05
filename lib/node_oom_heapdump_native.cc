#include <nan.h>
#include <v8-profiler.h>
#include <stdlib.h>
#if defined(_WIN32)
  #include <time.h>
  #define snprintf _snprintf
#else
  #include <sys/time.h>
#endif

using namespace v8;

char filename[256];
bool addTimestamp;
bool processingOOM = false;

class FileOutputStream: public OutputStream {
  public:
    FileOutputStream(FILE* stream): stream_(stream) { }
    virtual int GetChunkSize() {
      return 65536;
    }
    virtual void EndOfStream() { }
    virtual WriteResult WriteAsciiChunk(char* data, int size) {
      const size_t len = static_cast<size_t>(size);
      size_t off = 0;
      while (off < len && !feof(stream_) && !ferror(stream_))
        off += fwrite(data + off, 1, len - off, stream_);
      return off == len ? kContinue : kAbort;
    }

  private:
    FILE* stream_;
};

void OnOOMError(const char *location, bool is_heap_oom) {
  if (processingOOM) {
    fprintf(stderr, "FATAL: OnOOMError called more than once.\n");
    exit(2);
  }
  processingOOM = true;

  if (addTimestamp) {
    // Add timestamp to filename
    time_t rawtime;
    struct tm* timeinfo;
    time(&rawtime);
    timeinfo = localtime(&rawtime);

    char * pch;
    pch = strstr (filename,".heapsnapshot");
    strncpy (pch,"",1);
    strcat (filename, "-%Y%m%dT%H%M%S.heapsnapshot");

    char newFilename[256];
    strftime(newFilename, sizeof(filename), filename, timeinfo);
    strcpy(filename, newFilename);
  }

  fprintf(stderr, "Generating Heapdump to '%s' now...\n", filename);
  FILE* fp = fopen(filename, "w");
  if (fp == NULL) abort();

  // Create heapdump, depending on which Node.js version this can differ
  // for now, just support Node.js 7 and higher
  const HeapSnapshot* snap = v8::Isolate::GetCurrent()->GetHeapProfiler()->TakeHeapSnapshot();
  
  FileOutputStream stream(fp);
  snap->Serialize(&stream, HeapSnapshot::kJSON);
  fclose(fp);

  fprintf(stderr, "Done! Exiting process now.\n");
  exit(1);
}

void ParseArgumentsAndSetErrorHandler(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  isolate->SetOOMErrorHandler(OnOOMError);

  // parse JS arguments
  // 1: filename
  // 2: addTimestamp boolean
  #if NODE_VERSION_AT_LEAST(13, 0, 0)
  Local<Context> context = isolate->GetCurrentContext();
  String::Utf8Value fArg(isolate, args[0]->ToString(context).ToLocalChecked());
  #elif NODE_VERSION_AT_LEAST(12, 0, 0)
  String::Utf8Value fArg(isolate, args[0]->ToString(isolate));
  #elif NODE_VERSION_AT_LEAST(9, 0, 0)
  String::Utf8Value fArg(isolate, args[0]->ToString());
  #else
  String::Utf8Value fArg(args[0]->ToString());
  #endif
  strncpy(filename, (const char*)(*fArg), sizeof(filename) - 1);

  #if NODE_VERSION_AT_LEAST(12, 0, 0)
  addTimestamp = args[1]->BooleanValue(isolate);
  #else
  addTimestamp = args[1]->BooleanValue();
  #endif
}

void init(Local<Object> exports) {
  NODE_SET_METHOD(exports, "call", ParseArgumentsAndSetErrorHandler);
}

NODE_MODULE(NODE_OOM_HEAPDUMP_NATIVE, init)
