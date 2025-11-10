// components/RichTextEditor.js
import React, { useRef, useEffect } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { tinymceConfig } from "../config/tinymce";

// Импорты TinyMCE
import "tinymce/tinymce";
import "tinymce/icons/default/icons";
import "tinymce/themes/silver/theme";
import "tinymce/plugins/advlist";
import "tinymce/plugins/autolink";
import "tinymce/plugins/lists";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/charmap";
import "tinymce/plugins/preview";
import "tinymce/plugins/anchor";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/code";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/media";
import "tinymce/plugins/table";
import "tinymce/plugins/help";
import "tinymce/plugins/wordcount";

function RichTextEditor({ value, onChange, height = 500 }) {
  const editorRef = useRef(null);

  // ✅ Глобальное предотвращение перезагрузки
  useEffect(() => {
    const preventDefault = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Блокируем все события перетаскивания на уровне документа
    document.addEventListener("dragover", preventDefault, false);
    document.addEventListener("drop", preventDefault, false);

    return () => {
      document.removeEventListener("dragover", preventDefault, false);
      document.removeEventListener("drop", preventDefault, false);
    };
  }, []);

  // ✅ Универсальный обработчик загрузки изображений
  const handleImageUpload = (blobInfo) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", blobInfo.blob(), blobInfo.filename());

      fetch("/api/articles/tinymce/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.location) {
            resolve(data.location);
          } else {
            reject("No location in response");
          }
        })
        .catch((error) => {
          reject("Upload error: " + error.message);
        });
    });
  };

  const editorInit = {
    ...tinymceConfig.init,
    height: height,

    // ✅ Основные настройки загрузки изображений
    images_upload_handler: handleImageUpload,
    automatic_uploads: true,
    // images_reuse_filename: true,

    // ✅ ВАЖНО: Отключаем вставку base64
    paste_data_images: false,

    // ✅ Настройка file_picker для кнопки "Изображение"
    file_picker_types: "image",
    setup: (editor) => {
      console.log("TinyMCE editor setup");

      // ✅ Блокируем ВСЕ события перетаскивания в редакторе
      editor.on("drag dragover dragenter dragleave drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Editor drag event blocked:", e.type);

        if (e.type === "drop") {
          console.log("File dropped in editor - handling manually");
          handleDropEvent(editor, e);
        }

        return false;
      });

      // ✅ Предотвращаем действие по умолчанию для других событий
      editor.on("keydown", (e) => {
        // Блокируем некоторые комбинации клавиш, которые могут вызывать перезагрузку
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          console.log("Ctrl+S blocked");
        }
      });
    },
  };

  // ✅ Функция для обработки перетаскивания файлов
  const handleDropEvent = (editor, e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          const blobInfo = {
            blob: () => file,
            filename: () => file.name,
            id: () => Date.now().toString(),
          };

          // Вставляем placeholder
          const placeholderId = `uploading-${Date.now()}`;
          const placeholderHtml = `<img id="${placeholderId}" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zNWVtIj5VcGxvYWRpbmc8L3RleHQ+PC9zdmc+" alt="Uploading..." class="uploading" />`;

          editor.insertContent(placeholderHtml);

          // Загружаем изображение
          handleImageUpload(blobInfo)
            .then((imageUrl) => {
              const img = editor.dom.get(placeholderId);
              if (img) {
                img.src = imageUrl;
                img.classList.remove("uploading");
                img.removeAttribute("id");
              }
            })
            .catch((error) => {
              console.error("Failed to upload dropped image:", error);
              const img = editor.dom.get(placeholderId);
              if (img) {
                img.src =
                  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZWJlYiIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjZDMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zNWVtIj5FcnJvcjwvdGV4dD48L3N2Zz4=";
                img.alt = "Upload failed";
                img.classList.remove("uploading");
              }
            });
        }
      });
    }
  };
  // ✅ Функция для обработки перетащенных файлов

  return (
    <div
      className="rich-text-editor"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Editor
        onInit={(evt, editor) => {
          editorRef.current = editor;
          console.log("TinyMCE editor initialized");
        }}
        value={value}
        onEditorChange={(newValue, editor) => {
          // ✅ Вызываем onChange только когда это необходимо
          onChange(newValue);
        }}
        init={editorInit}
      />
    </div>
  );
}

export default RichTextEditor;
