import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { FileVideo, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from '@ffmpeg/util'
import { api } from "@/lib/axios";

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success' | 'error'
const statusMessage = {
    converting: 'Convertendo...',
    uploading: 'Enviando...',
    generating: 'Transcrevendo...',
    success: 'Sucesso!',
    error: 'Erro ao converter!'
}

interface VideoInputFormProps {
    onVideoUploaded: (id: string) => void;
}

export function VideoInputForm(props: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File|null>(null)
    const [uploadStatus, setUploadStatus] = useState<Status>('waiting')

    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const { files } = event.currentTarget

        if(!files) {
            return
        }

        const selectedFile = files[0]

        setVideoFile(selectedFile)
    }

    async function convertVideoToFile(video: File) {
        console.log('Convert started')

        const ffmpeg = await getFFmpeg()

        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        // ffmpeg.on('log', log => {
        //     console.log(log)
        // })

        ffmpeg.on('progress', progress => {
            console.log('Convert progress: ' + Math.round(progress.progress * 100))
        })

        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
        ])

        const data = await ffmpeg.readFile('output.mp3')
        const audioFileBlob = new Blob([data], {type: 'audio/mpeg'})
        const audioFile = new File([audioFileBlob], 'audio.mp3', {type: 'audio/mpeg'})

        console.log('File converted')

        return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const prompt = promptInputRef.current?.value

        if(!videoFile) {
            return
        }

        // converter o video em audio
        setUploadStatus('converting')
        const audioFile = await convertVideoToFile(videoFile)

        // console.log(audioFile, prompt)
        const data = new FormData()
        data.append('file', audioFile)

        setUploadStatus('uploading')
        const response = await api.post('/videos', data)
        // console.log(response.data)

        const videoId = response.data.video.id
        setUploadStatus('generating')
        await api.post(`/videos/${videoId}/transcription`, {
            prompt
        })

        console.log('All done!')
        setUploadStatus('success')

        props.onVideoUploaded(videoId)
    }

    const previewUrl = useMemo(() => {
        if (!videoFile) {
            return null
        }

        return URL.createObjectURL(videoFile)
    }, [videoFile])

    return (
        <form onSubmit={handleUploadVideo} action="" className="space-y-6">
            <label 
              className="relative overflow-hidden border flex rounded-md w-full aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5"
              htmlFor="video"
            >
                {previewUrl ? (
                    <video src={previewUrl} controls={false} className="pointer-events-none absolute inset-0" />
                ) : (
                    <>
                        <FileVideo className="w-4 h-4" />
                        Selecione um video
                    </>
                )}
              
            </label>
            <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected} />

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
              <Textarea
                ref={promptInputRef}
                disabled={uploadStatus != 'waiting'}
                id="transcription_prompt"
                className="h-20 leading-relaxed resize-none"
                placeholder="Inclua palavras-chave mencionadas no video separadas por vírgula (,)"
              />
            </div>

            <Button 
                data-success={uploadStatus == 'success'}
                disabled={uploadStatus != 'waiting'} 
                type="submit" 
                className="w-full data-[success=true]:bg-emerald-400"
            >
                { uploadStatus == 'waiting' ? (
                    <>
                        Carregar video
                        <Upload className="w-4 h-4 ml-2" />
                    </>
                ): statusMessage[uploadStatus]}
            </Button>
          </form>
    )
}